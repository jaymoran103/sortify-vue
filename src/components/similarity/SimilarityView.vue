<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSimilarityStore } from '@/stores/similarity'
import { useCursorStore } from '@/stores/cursor'
import { useSessionStore } from '@/stores/sessions'
import { usePlaylistStore } from '@/stores/playlists'
import { useTrackStore } from '@/stores/tracks'
import { useEquivalenceStore } from '@/stores/equivalence'
import { useListSelection } from '@/composables/useListSelection'
import { useModal } from '@/composables/useModal'
import { describeConsolidation, planConsolidation } from '@/similarity/consolidate'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import CursorBar from '@/components/similarity/CursorBar.vue'
import DoublesReviewPanel from '@/components/similarity/DoublesReviewPanel.vue'
import NoticedRail from '@/components/similarity/NoticedRail.vue'
import OperationPalette from '@/components/similarity/OperationPalette.vue'
import ResultControlBar from '@/components/similarity/ResultControlBar.vue'
import ResultTable from '@/components/similarity/ResultTable.vue'
import ResultVerbStrip from '@/components/similarity/ResultVerbStrip.vue'
import type { ResultRow } from '@/similarity/types'
import type { EquivalenceGroup, Track } from '@/types/models'

const store = useSimilarityStore()
const cursor = useCursorStore()
const sessionStore = useSessionStore()
const playlistStore = usePlaylistStore()
const trackStore = useTrackStore()
const equivalence = useEquivalenceStore()
const modal = useModal()
const router = useRouter()

// ── Selection ─────────────────────────────────────────────────────────────────
// Composed at the view level, as every other list in the app does. ResultTable stays dumb.
const rows = computed<ResultRow[]>(() => store.rows)
const {
  selectedIds,
  toggle,
  clear: clearSelection,
} = useListSelection(rows, (row) => row.key, { selectMultiple: true })

const selectedRows = computed(() => rows.value.filter((row) => selectedIds.value.has(row.key)))

// ── Scope ─────────────────────────────────────────────────────────────────────
const scopeLabel = computed(() => {
  if (cursor.isEmpty) return 'Whole library'
  const noun = cursor.subject === 'track' ? 'track' : 'playlist'
  return `${cursor.count} ${noun}${cursor.count === 1 ? '' : 's'}`
})

// ── Empty states ──────────────────────────────────────────────────────────────
const preThresholdCount = computed(
  () => store.notes.find((note) => note.kind === 'pre-threshold-count')?.count ?? 0,
)

// Three distinct cases. A single generic "no results" would hide which one the user is in, and a
// high threshold reading as breakage is the most likely way this feature looks broken when it
// is working correctly.
const emptyMessage = computed(() => {
  if ((playlistStore.playlists ?? []).length === 0) {
    return 'No playlists yet. Import some to get started.'
  }
  if (preThresholdCount.value > 0) {
    const percent = Math.round(store.controls.threshold * 100)
    return `Nothing above the ${percent}% threshold. ${preThresholdCount.value} pairs overlap at all - lower the threshold to see them.`
  }
  return 'Nothing in this library overlaps.'
})

// ── Doubles review ────────────────────────────────────────────────────────────
const reviewingGroupId = ref<number | null>(null)

/** Groups currently listed, in the order the rows show them, so Next Set follows the eye. */
const listedGroups = computed<EquivalenceGroup[]>(() => {
  if (store.mode !== 'doubles') return []
  const byId = new Map(equivalence.all.map((group) => [group.id, group]))
  return rows.value
    .map((row) => byId.get(Number(row.key.replace(/^g/, ''))))
    .filter((group): group is EquivalenceGroup => group !== undefined)
})

const reviewingGroup = computed<EquivalenceGroup | null>(
  () => listedGroups.value.find((group) => group.id === reviewingGroupId.value) ?? null,
)

const reviewPosition = computed(() => ({
  index: listedGroups.value.findIndex((group) => group.id === reviewingGroupId.value),
  total: listedGroups.value.length,
}))

const trackLookup = computed(() => {
  const map = new Map<string, Track>()
  for (const track of trackStore.tracks ?? []) map.set(track.trackID, track)
  return map
})

const hasConfirmedDoubles = computed(() => equivalence.confirmedGroups.length > 0)

/** Opens review for a row. Only doubles rows carry a group id. */
function openReview(key: string): void {
  if (store.mode !== 'doubles') return
  const id = Number(key.replace(/^g/, ''))
  reviewingGroupId.value = Number.isFinite(id) ? id : null
}

/** Advances to the next group in the list, wrapping to the start. */
function reviewNext(): void {
  const groups = listedGroups.value
  if (groups.length === 0) return
  const next = (reviewPosition.value.index + 1) % groups.length
  reviewingGroupId.value = groups[next]?.id ?? null
}

async function preferVariant(trackId: string): Promise<void> {
  if (reviewingGroupId.value === null) return
  await equivalence.setPreferred(reviewingGroupId.value, trackId)
}

async function confirmGroup(): Promise<void> {
  if (reviewingGroupId.value === null) return
  await equivalence.confirm(reviewingGroupId.value)
  reviewNext()
  await store.run()
}

async function rejectGroup(): Promise<void> {
  if (reviewingGroupId.value === null) return
  await equivalence.reject(reviewingGroupId.value)
  reviewNext()
  await store.run()
}

async function approveAll(): Promise<void> {
  const ids = listedGroups.value
    .filter((group) => group.status === 'unconfirmed' && group.id !== undefined)
    .map((group) => group.id as number)
  if (ids.length === 0) return

  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Approve all doubles',
    message: `Mark ${ids.length} group(s) as confirmed? Overlap will start counting each group as one track.`,
    confirmLabel: `Approve ${ids.length}`,
    danger: false,
  })
  if (!confirmed) return

  await equivalence.confirmAll(ids)
  await store.run()
}

/**
 * Rewrites the selected playlists to keep one variant per confirmed group.
 *
 * The module's only destructive action. Scoped to the cursor when it holds playlists, otherwise to
 * the playlists the group actually touches, so it can never become a library-wide pass.
 */
async function consolidate(): Promise<void> {
  const group = reviewingGroup.value
  if (!group) return

  const preferredTrackId = group.preferredTrackId ?? group.trackIds[0]
  if (!preferredTrackId) return

  const all = playlistStore.playlists ?? []
  const scoped = cursor.subject === 'playlist' && !cursor.isEmpty
    ? all.filter((playlist) => cursor.ids.includes(String(playlist.id)))
    : all.filter((playlist) => group.trackIds.some((id) => playlist.trackIDs.includes(id)))

  const plan = planConsolidation(
    scoped
      .filter((playlist) => playlist.id !== undefined)
      .map((playlist) => ({
        id: playlist.id as number,
        name: playlist.name,
        trackIDs: playlist.trackIDs,
      })),
    [{ trackIds: group.trackIds, preferredTrackId }],
  )

  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Consolidate playlists',
    message: describeConsolidation(plan),
    confirmLabel: plan.playlistCount === 0 ? 'OK' : `Consolidate ${plan.playlistCount} playlist(s)`,
    danger: plan.playlistCount > 0,
  })
  if (!confirmed || plan.playlistCount === 0) return

  await playlistStore.batchUpdatePlaylists(
    plan.rewrites.map((rewrite) => ({ id: rewrite.id, changes: { trackIDs: rewrite.trackIDs } })),
  )
  await store.run()
}

// ── Verbs ─────────────────────────────────────────────────────────────────────
/**
 * Resolves the selected rows to library playlist IDs.
 *
 * Track rows resolve to the playlists containing those tracks rather than opening as loose
 * tracks, because a workspace session persists only playlistIds and loose tracks do not survive
 * a reload.
 */
function selectedPlaylistIds(): number[] {
  const ids = new Set<number>()
  for (const row of selectedRows.value) {
    if (row.subject === 'playlist') {
      for (const id of row.memberIds) ids.add(Number(id))
      continue
    }
    for (const playlist of playlistStore.playlists ?? []) {
      if (playlist.id !== undefined && row.memberIds.some((t) => playlist.trackIDs.includes(t))) {
        ids.add(playlist.id)
      }
    }
  }
  return [...ids]
}

async function openInWorkspace(): Promise<void> {
  const ids = selectedPlaylistIds()
  if (ids.length === 0) return
  const sessionId = await sessionStore.createSession(ids)
  await router.push({ path: '/workspace', query: { session: String(sessionId) } })
}

async function saveAsSession(): Promise<void> {
  const ids = selectedPlaylistIds()
  if (ids.length === 0) return
  await sessionStore.createSession(ids)
}

/** One track set per selected playlist, or a single merged set when the rows are track rows. */
function trackSetsForSelection(): string[][] {
  if (selectedRows.value[0]?.subject === 'track') {
    return [[...new Set(selectedRows.value.flatMap((row) => row.memberIds))]]
  }
  return selectedPlaylistIds().map((id) => {
    const playlist = (playlistStore.playlists ?? []).find((p) => p.id === id)
    return playlist ? [...new Set(playlist.trackIDs)] : []
  })
}

/**
 * Creates a playlist from the selected rows under one of the three set operations.
 * With a single set every mode collapses to that set, so union is used.
 */
async function createPlaylist(mode: 'union' | 'intersection' | 'complement'): Promise<void> {
  const sets = trackSetsForSelection()
  if (sets.length === 0) return

  let trackIDs: string[]
  if (mode === 'union' || sets.length === 1) {
    trackIDs = [...new Set(sets.flat())]
  } else if (mode === 'intersection') {
    const rest = sets.slice(1).map((set) => new Set(set))
    trackIDs = sets[0]!.filter((id) => rest.every((set) => set.has(id)))
  } else {
    const rest = sets.slice(1).map((set) => new Set(set))
    trackIDs = sets[0]!.filter((id) => rest.every((set) => !set.has(id)))
  }

  await playlistStore.addPlaylist({ name: `Similarity ${mode}`, trackIDs })
}

/** Pushes the selection into the cursor so the result feeds the next operation. */
function analyze(): void {
  cursor.setFromRows(selectedRows.value)
  clearSelection()
}

/** Row clicks both select for the verb strip and, in doubles mode, open review. */
function onRowClick(key: string, event: MouseEvent): void {
  toggle(key, event)
  openReview(key)
}

/** Applying a preset closes any open review, since the list beneath it just changed. */
async function onSelectPreset(key: string): Promise<void> {
  reviewingGroupId.value = null
  await store.applyPreset(key)
  await store.refreshRail()
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goBack(): void {
  router.push({ name: 'dashboard' })
}

/** Library scale, for the header meta line. Mirrors the workspace header's playlists/tracks form. */
const libraryMeta = computed(() => {
  const playlists = (playlistStore.playlists ?? []).length
  const tracks = new Set((playlistStore.playlists ?? []).flatMap((p) => p.trackIDs)).size
  return `${playlists} playlist${playlists === 1 ? '' : 's'} \u00b7 ${tracks} track${tracks === 1 ? '' : 's'}`
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await store.run()
  await store.refreshRail()
})

// applyPreset and setControls re-run themselves, so only the cursor needs a watcher here.
watch(
  () => cursor.scope,
  () => {
    clearSelection()
    void store.run()
  },
)

// The library hydrates asynchronously through liveQuery, so arriving here on a cold load (a
// bookmark, a refresh, a deep link) can run the first scan before any playlists exist. Re-run
// once they arrive. Only the idle case retries: a ready index that goes stale after a user edit
// stays stale until they ask for a rebuild, so editing a playlist never triggers surprise work.
watch(
  () => store.libraryRevision,
  async () => {
    if (store.indexStatus !== 'idle') return
    await store.run()
    // The rail is computed from a ready index, so it has to be recomputed here too. Refreshing it
    // only at mount left it permanently empty on any cold load.
    await store.refreshRail()
  },
)

onBeforeUnmount(() => {
  store.dispose()
})
</script>

<template>
  <div class="similarity-view">
    <!-- Page header, matching the workspace view: back, title, then muted meta. -->
    <header class="similarity-view__header">
      <button class="btn btn--secondary" @click="goBack">Back to Dashboard</button>
      <h1 class="similarity-view__title">Similarity</h1>
      <span class="similarity-view__meta text-muted">{{ libraryMeta }}</span>
    </header>

    <CursorBar
      :scope-label="scopeLabel"
      :is-empty="cursor.isEmpty"
      :index-status="store.indexStatus"
      :unique-track-count="store.indexStats?.uniqueTrackCount ?? null"
      :progress="store.scanProgress"
      @rebuild="store.run()"
      @clear="cursor.clear()"
    />

    <div class="similarity-view__body">
      <OperationPalette :active-key="store.activePresetKey" @select="onSelectPreset">
        <template #rail>
          <NoticedRail
            :findings="store.railFindings"
            :is-stale="store.indexStatus === 'stale'"
            @select="onSelectPreset"
          />
        </template>
      </OperationPalette>

      <section class="similarity-view__result">
        <ResultControlBar
          :controls="store.controls"
          :doubles-controls="store.doublesControls"
          :measures="rows[0]?.measures ?? []"
          :mode="store.mode"
          :equivalence-enabled="store.equivalenceEnabled"
          :has-confirmed-doubles="hasConfirmedDoubles"
          @update="store.setControls($event)"
          @update-doubles="store.setDoublesControls($event)"
          @update-equivalence="store.setEquivalenceEnabled($event)"
        />

        <p v-if="store.error" class="similarity-view__error text-sm">{{ store.error }}</p>

        <!-- Scan notes carry every exclusion the scan made. No silent caps. -->
        <ul v-if="store.notes.length" class="similarity-view__notes">
          <li v-for="note in store.notes" :key="note.kind" class="text-muted text-xs">
            {{ note.message }}
          </li>
        </ul>

        <ResultTable
          :rows="rows"
          :selected-keys="selectedIds"
          :empty-message="emptyMessage"
          @row-click="onRowClick"
        />

        <DoublesReviewPanel
          v-if="reviewingGroup"
          :group="reviewingGroup"
          :tracks="trackLookup"
          :playlists="playlistStore.playlists ?? []"
          :position="reviewPosition"
          @prefer="preferVariant"
          @confirm="confirmGroup"
          @reject="rejectGroup"
          @consolidate="consolidate"
          @approve-all="approveAll"
          @rescan="store.run()"
          @next="reviewNext"
          @close="reviewingGroupId = null"
        />

        <ResultVerbStrip
          :selected-rows="selectedRows"
          @open-in-workspace="openInWorkspace"
          @save-as-session="saveAsSession"
          @create-playlist="createPlaylist"
          @analyze="analyze"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.similarity-view {
  display: flex;
  flex-direction: column;
  /* 100vh, not 100%: nothing above this sets a height, so a percentage collapses to content
     height and the view stops filling the screen. WorkspaceView solves it the same way. */
  height: 100vh;
  min-height: 0;
}

/* Ported from WorkspaceView so the two pages share one header treatment. */
.similarity-view__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
}

.similarity-view__title {
  flex: 1;
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.similarity-view__meta {
  white-space: nowrap;
}

.similarity-view__body {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  flex: 1;
  min-height: 0;
}

.similarity-view__result {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.similarity-view__error {
  padding: var(--space-2) var(--space-3);
  color: var(--color-danger-hover);
}

.similarity-view__notes {
  margin: 0;
  padding: var(--space-1) var(--space-3);
  list-style: none;
}

@media (max-width: 720px) {
  .similarity-view__body {
    grid-template-columns: 1fr;
  }
}
</style>
