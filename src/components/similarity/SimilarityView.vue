<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSimilarityStore } from '@/stores/similarity'
import { useCursorStore } from '@/stores/cursor'
import { useSessionStore } from '@/stores/sessions'
import { usePlaylistStore } from '@/stores/playlists'
import { useListSelection } from '@/composables/useListSelection'
import CursorBar from '@/components/similarity/CursorBar.vue'
import OperationPalette from '@/components/similarity/OperationPalette.vue'
import ResultControlBar from '@/components/similarity/ResultControlBar.vue'
import ResultTable from '@/components/similarity/ResultTable.vue'
import ResultVerbStrip from '@/components/similarity/ResultVerbStrip.vue'
import type { ResultRow } from '@/similarity/types'

const store = useSimilarityStore()
const cursor = useCursorStore()
const sessionStore = useSessionStore()
const playlistStore = usePlaylistStore()
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

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  void store.run()
})

// applyPreset and setControls re-run themselves, so only the cursor needs a watcher here.
watch(
  () => cursor.scope,
  () => {
    clearSelection()
    void store.run()
  },
)

onBeforeUnmount(() => {
  store.dispose()
})
</script>

<template>
  <div class="similarity-view">
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
      <OperationPalette :active-key="store.activePresetKey" @select="store.applyPreset($event)" />

      <section class="similarity-view__result">
        <ResultControlBar
          :controls="store.controls"
          :measures="rows[0]?.measures ?? []"
          @update="store.setControls($event)"
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
          @row-click="toggle"
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
  height: 100%;
  min-height: 0;
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
