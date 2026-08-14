<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useWorkspaceStore } from '@/stores/workspace'
import { useModal } from '@/composables/useModal'
import { useListFilter } from '@/composables/useListFilter'
import { useListSort } from '@/composables/useListSort'
import { useListSelection } from '@/composables/useListSelection'
import { useContextMenu } from '@/composables/useContextMenu'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { openSpotifyURI, copyToClipboard } from '@/utils/spotifyLinks'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import PromptModal from '@/components/modals/PromptModal.vue'
import PlaylistSelectModal from '@/components/dashboard/PlaylistSelectModal.vue'
import TrackSelectModal from '@/components/dashboard/TrackSelectModal.vue'
import ControlBar from '@/components/common/ControlBar.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import TrackRow from './TrackRow.vue'
import PlaylistColumnHeader from './PlaylistColumnHeader.vue'
import AddContentModal from './AddContentModal.vue'
import type { Track, PlaylistId } from '@/types/models'
import type { SortOption, MenuEntry, AddContentChoice } from '@/types/ui'

const route = useRoute()
const router = useRouter()
const workspaceStore = useWorkspaceStore()
const modal = useModal()
const ctx = useContextMenu()

// trackID → number of workspace playlists containing it.
// Memoized because the "Most Playlists" comparator would otherwise re-scan every playlist for
// both operands on every comparison — O(n log n × 2P). One pass per playlist change instead.
// Read inside compareFn at sort time, so it always reflects current membership.
const playlistCountMap = computed<Map<string, number>>(() => {
  const counts = new Map<string, number>()
  for (const pl of workspaceStore.playlists) {
    for (const tid of pl.trackIdSet) {
      counts.set(tid, (counts.get(tid) ?? 0) + 1)
    }
  }
  return counts
})

// Sort options always available for workspace tracks.
const staticSortOptions: SortOption<Track>[] = [
  { key: 'order-added', label: 'Order Added', compareFn: () => 0 },
  { key: 'title', label: 'Title', compareFn: (a, b) => a.title.localeCompare(b.title) },
  { key: 'artist', label: 'Artist', compareFn: (a, b) => a.artist.localeCompare(b.artist) },
  { key: 'album', label: 'Album', compareFn: (a, b) => a.album.localeCompare(b.album) },
  {
    key: 'most-playlists',
    label: 'Most Playlists',
    compareFn: (a, b) =>
      (playlistCountMap.value.get(b.trackID) ?? 0) - (playlistCountMap.value.get(a.trackID) ?? 0),
  },
]

// Playlist whose order is currently driving the sort, or null when that sort is inactive.
const playlistSortId = ref<PlaylistId | null>(null)

/**
 * Build a comparator ordering tracks by their position within one playlist.
 * Members sort ahead of non-members, in playlist order; non-members keep their relative
 * order. Returns a no-op comparator if the playlist has left the workspace.
 */
function buildPlaylistSortComparator(playlistId: PlaylistId): (a: Track, b: Track) => number {
  return (a: Track, b: Track) => {
    const pl = workspaceStore.playlists.find((p) => p.id === playlistId)
    if (!pl) return 0
    const idxA = pl.trackIDs.indexOf(a.trackID)
    const idxB = pl.trackIDs.indexOf(b.trackID)
    // indexOf returns -1 for non-members, which would sort them first — map to Infinity
    // so they fall to the bottom instead.
    const posA = idxA === -1 ? Infinity : idxA
    const posB = idxB === -1 ? Infinity : idxB
    return posA - posB
  }
}

// Static options plus, when active, a dynamic entry for the chosen playlist. Passing this
// computed (rather than a plain array) to useListSort is why D2 widened that signature.
// When the sorted playlist leaves the workspace the entry disappears and useListSort's
// unknown-key fallback drops the view back to the first static option.
const sortOptions = computed<SortOption<Track>[]>(() => {
  if (playlistSortId.value === null) return staticSortOptions
  const pl = workspaceStore.playlists.find((p) => p.id === playlistSortId.value)
  if (!pl) return staticSortOptions
  return [
    ...staticSortOptions,
    {
      key: `playlist:${String(playlistSortId.value)}`,
      label: `Playlist: ${pl.name}`,
      compareFn: buildPlaylistSortComparator(playlistSortId.value),
    },
  ]
})

// Chain: trackList -> filtered -> sorted -> displayTracks
const { query, filtered } = useListFilter<Track>(
  computed(() => workspaceStore.trackList),
  (track, q) => {
    const lower = q.toLowerCase()
    return (
      track.title.toLowerCase().includes(lower) ||
      track.artist.toLowerCase().includes(lower) ||
      track.album.toLowerCase().includes(lower)
    )
  },
)
const { currentSort, sorted: displayTracks } = useListSort<Track>(filtered, sortOptions)

// Retire the dynamic playlist option as soon as the user picks a static sort, so a stale
// "Playlist: X" entry does not linger in the dropdown.
watch(currentSort, (key) => {
  if (playlistSortId.value !== null && !key.startsWith('playlist:')) {
    playlistSortId.value = null
  }
})

/**
 * Activate the playlist-order sort for one column, adding its dynamic option and selecting it.
 * Side effect: sets playlistSortId and currentSort.
 */
function handleSortByPlaylist(playlistId: PlaylistId): void {
  playlistSortId.value = playlistId
  currentSort.value = `playlist:${String(playlistId)}`
}

// Row selection: single-click selects, shift extends, cmd togglesss.
// validItems uses full trackList so filter changes do not deselect.
const rowSelection = useListSelection<Track>(
  displayTracks,
  (track) => track.trackID,
  { selectMultiple: false },
  computed(() => workspaceStore.trackList),
)

// Dynamic CSS grid column template: index + track info + one column per playlist.
// TODO refactor: this feels hacky
const columnTemplate = computed(() => {
  const playlistCols = workspaceStore.playlists.map(() => 'minmax(100px, 200px)').join(' ')
  return `60px minmax(200px, 1fr) ${playlistCols}`
})

// Configure virtualizer: use displayTracks count, scroll container, and estimated row height.
// Set overscan to 10 rows for now to balance performance and smoothness during scrolling.
const scrollContainer = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(
  computed(() => ({
    count: displayTracks.value.length,
    getScrollElement: () => scrollContainer.value,
    estimateSize: () => 48,
    overscan: 10,
  })),
)
// On component mount, load the session based on the 'session' query parameter.
onMounted(async () => {
  await workspaceStore.loadSession(Number(route.query.session))
})

// Reset store before unmounting to clear session data and avoid flash of stale content if user quickly opens another session.
onBeforeUnmount(() => {
  workspaceStore.$reset()
})

/**
 * Assemble the leave-guard warning for the current session state.
 *
 * Returns a single merged message, or null when nothing is at risk — one modal, never two.
 * No side effects.
 *
 * Empty-playlist mentions are restricted to playlists in modifiedIds, i.e. ones this session
 * actually touched. A pre-existing empty playlist the user never edited is not their problem
 * on the way out, so it stays quiet.
 *
 * Known edge, accepted: modifiedIds marks a playlist modified for any reason, so renaming or
 * reordering an already-empty playlist will surface it here.
 */
function buildLeaveWarning(): string | null {
  const clauses: string[] = []

  if (workspaceStore.hasUnsavedChanges) {
    clauses.push('You have unsaved changes.')
  }

  const touchedEmpty = workspaceStore.playlists.filter(
    (p) => p.trackIDs.length === 0 && workspaceStore.modifiedIds.has(p.id),
  )
  if (touchedEmpty.length > 0) {
    const names = touchedEmpty.map((p) => `"${p.name}"`).join(', ')
    clauses.push(
      touchedEmpty.length === 1
        ? `${names} has no tracks.`
        : `${touchedEmpty.length} playlists have no tracks: ${names}.`,
    )
  }

  // Tracks added but never assigned live only in the in-memory buffer and vanish on reload.
  // Adding them marks no playlist modified, so without this clause hasUnsavedChanges stays
  // false and the guard would not fire at all for an add-then-abandon flow (D6).
  const unassigned = workspaceStore.unassignedTrackIds.length
  if (unassigned > 0) {
    clauses.push(
      unassigned === 1
        ? '1 track is not in any playlist and will be discarded.'
        : `${unassigned} tracks are not in any playlist and will be discarded.`,
    )
  }

  if (clauses.length === 0) return null
  return `${clauses.join(' ')} Leave without saving?`
}

// Before navigating away from the workspace, warn only if something is actually at stake.
// FUTURE: Give option to save changes here as well.
onBeforeRouteLeave(async (_to, _from, next) => {
  const warning = buildLeaveWarning()

  // Nothing at risk — reset the store and navigate away without interrupting.
  if (warning === null) {
    workspaceStore.$reset()
    next()
    return
  }

  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Leave Workspace',
    message: warning,
    confirmLabel: 'Leave',
    cancelLabel: 'Stay',
  })

  // If confirmed, reset the store and navigate away. Otherwise stay on page.
  if (confirmed) {
    workspaceStore.$reset()
    next()
  } else {
    next(false)
  }
})

// Navigate back to the main app view. Currently specifying as dashboard, since the root page is currently the about view.
function goBack(): void {
  router.push({ name: 'dashboard' }) 
}

// Time of the most recent successful save, formatted for display. Deliberately
// component-local: it dies with the component on unmount, which is the correct lifecycle
// for it, so no reset wiring is needed.
const lastSavedTime = ref<string | null>(null)

// Handle save action: call the store's save method, which persists the session to IndexedDB.
// Stamps lastSavedTime only after the write resolves, so the label never claims a save that failed.
async function handleSave(): Promise<void> {
  await workspaceStore.save()
  lastSavedTime.value = new Date().toLocaleTimeString()
}

// Helper to get track at a given virtualizer row index from the filtered+sorted displayTracks list.
function trackAt(index: number): Track {
  const track = displayTracks.value[index]
  if (!track) throw new Error(`No track at index ${index}`)
  return track
}

// ─── Playlist column action handlers ────────────────────────────────────────

async function handleRename(playlistId: PlaylistId): Promise<void> {
  const pl = workspaceStore.playlists.find((p) => p.id === playlistId)
  if (!pl) return
  const newName = await modal.open<string>(PromptModal, {
    title: 'Rename Playlist',
    label: 'New name',
    initialValue: pl.name,
    confirmLabel: 'Rename',
  })
  if (newName) {
    workspaceStore.renamePlaylist(playlistId, newName)
  }
}

function handleRemove(playlistId: PlaylistId): void {
  workspaceStore.removePlaylist(playlistId)
}

function handleDuplicate(playlistId: PlaylistId): void {
  workspaceStore.duplicatePlaylist(playlistId)
}

/**
 * Set membership of every currently visible track in one playlist.
 *
 * Operates on displayTracks — the post-filter, post-sort list — so a search narrows the
 * action to what is on screen, matching vanilla. Side effect: mutates the workspace buffer
 * via the store; hidden tracks are left untouched.
 */
function handleSetAllInPlaylist(playlistId: PlaylistId, member: boolean): void {
  workspaceStore.setTracksInPlaylist(
    playlistId,
    displayTracks.value.map((t) => t.trackID),
    member,
  )
}

/**
 * Assemble and show the context menu for one playlist column.
 *
 * Inputs: the requesting playlist's id, and the originating mouse event used to position
 * the menu. Side effect: opens the shared context menu via useContextMenu().show().
 *
 * This is the single assembly point for the column menu. It lives here rather than in
 * PlaylistColumnHeader because upcoming entries depend on state only this view owns —
 * the filtered track count, the active sort, and Spotify URIs (design decision D1).
 * No-ops if the playlist is no longer in the workspace.
 */
function buildColumnMenu(playlistId: PlaylistId, event: MouseEvent): void {
  const index = workspaceStore.playlists.findIndex((p) => p.id === playlistId)
  if (index === -1) return

  // Bulk membership acts on what the user can currently see. The label says so explicitly:
  // these edits are buffered until Save and have no per-action undo, so naming the scope at
  // click time is the cheap safeguard against a filtered "select all" surprising someone.
  //
  // "Filtered" is derived from the visible count rather than from `query`, because the query
  // ref updates immediately while useListFilter debounces by 200ms. Reading `query` here
  // would let the label claim a scope the action would not actually apply.
  const visibleCount = displayTracks.value.length
  const isFiltered = visibleCount < workspaceStore.trackList.length
  const scope = isFiltered ? `${visibleCount} visible tracks` : `all ${visibleCount} tracks`

  const items: MenuEntry[] = [
    { label: `Add ${scope}`, action: () => handleSetAllInPlaylist(playlistId, true) },
    { label: `Remove ${scope}`, action: () => handleSetAllInPlaylist(playlistId, false) },
    { label: 'Sort by this Playlist', action: () => handleSortByPlaylist(playlistId) },
    { divider: true },
    { label: 'Rename', action: () => void handleRename(playlistId) },
    { label: 'Duplicate', action: () => handleDuplicate(playlistId) },
  ]

  // Move entries are offered only where there is somewhere to move to. The view knows each
  // playlist's index already, so the header no longer needs canMoveLeft/canMoveRight props.
  if (index > 0) {
    items.push({ label: 'Move Left', action: () => workspaceStore.movePlaylist(playlistId, -1) })
  }
  if (index < workspaceStore.playlists.length - 1) {
    items.push({ label: 'Move Right', action: () => workspaceStore.movePlaylist(playlistId, 1) })
  }

  items.push({ divider: true })
  items.push({ label: 'Remove from Workspace', action: () => handleRemove(playlistId) })

  // Spotify entries only for playlists that came from Spotify and carry a URI.
  const playlistURI = workspaceStore.playlists[index]?.playlistURI
  if (playlistURI) {
    items.push({ divider: true })
    items.push({ label: 'Open in Spotify', action: () => openSpotifyURI(playlistURI) })
    items.push({ label: 'Copy Playlist ID', action: () => void copyToClipboard(playlistURI) })
  }

  ctx.show(event, items)
}

// ─── Row selection + context menu handlers ────────────────────

function handleRowSelect(trackId: string, event: MouseEvent): void {
  rowSelection.toggle(trackId, event)
}

function handleTrackContextMenu(trackId: string, event: MouseEvent): void {
  // If right-clicked track isn't selected, select only it
  if (!rowSelection.isSelected(trackId)) {
    rowSelection.clear()
    rowSelection.toggle(trackId)
  }

  const selectedCount = rowSelection.selectedCount.value
  const items: MenuEntry[] = []

  if (selectedCount === 1) {
    items.push({ label: 'Add to All Playlists', action: () => handleAddToAll(trackId) })
    items.push({ label: 'Remove from All Playlists', action: () => handleRemoveFromAll(trackId) })
    items.push({ divider: true })
    items.push({ label: 'Remove from Workspace', action: () => handleDeleteTrack(trackId) })

    // Prefer the explicit spotifyURI field; fall back to the trackID when that is itself a
    // Spotify track URI, which is how Spotify-imported tracks are keyed. Track carries an
    // index signature, so narrow with typeof rather than asserting.
    // Kept inside the single-selection branch: there is no meaningful "open several tracks".
    const track = workspaceStore.tracks.get(trackId)
    const spotifyURI =
      (typeof track?.spotifyURI === 'string' ? track.spotifyURI : undefined) ??
      (trackId.startsWith('spotify:track:') ? trackId : undefined)

    if (spotifyURI) {
      items.push({ divider: true })
      items.push({ label: 'Open in Spotify', action: () => openSpotifyURI(spotifyURI) })
      items.push({ label: 'Copy Track ID', action: () => void copyToClipboard(spotifyURI) })
    }
  } else {
    items.push({
      label: `Add ${selectedCount} Tracks to All Playlists`,
      action: () => handleBulkAddToAll(),
    })
    items.push({
      label: `Remove ${selectedCount} Tracks from All Playlists`,
      action: () => handleBulkRemoveFromAll(),
    })
    items.push({ divider: true })
    items.push({
      label: `Remove ${selectedCount} Tracks from Workspace`,
      action: () => handleBulkDelete(),
    })
  }

  ctx.show(event, items)
}

// ─── Single track actions -------------------------------

function handleAddToAll(trackId: string): void {
  workspaceStore.addTrackToAll(trackId)
}

function handleRemoveFromAll(trackId: string): void {
  workspaceStore.removeTrackFromAll(trackId)
}

function handleDeleteTrack(trackId: string): void {
  workspaceStore.removeTrackFromWorkspace(trackId)
  rowSelection.clear()
}

// ─── Bulk track actions ---------––––––––––––––––––––––––––––––––––––

function handleBulkAddToAll(): void {
  workspaceStore.bulkAddToAll(rowSelection.selectedIds.value)
  rowSelection.clear()
}

async function handleBulkRemoveFromAll(): Promise<void> {
  const count = rowSelection.selectedCount.value
  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Remove from All Playlists',
    message: `Remove ${count} track(s) from all playlists in this workspace?`,
    confirmLabel: 'Remove',
  })
  if (confirmed) {
    workspaceStore.bulkRemoveFromAll(rowSelection.selectedIds.value)
    rowSelection.clear()
  }
}

async function handleBulkDelete(): Promise<void> {
  const count = rowSelection.selectedCount.value
  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Remove from Workspace',
    message: `Remove ${count} track(s) from the workspace entirely?`,
    confirmLabel: 'Remove',
  })
  if (confirmed) {
    workspaceStore.bulkRemoveFromWorkspace(rowSelection.selectedIds.value)
    rowSelection.clear()
  }
}

// ─── Add content flow + handlers ──────────────

/**
 * Run the add-content flow behind the control bar's single Add button.
 *
 * Opens AddContentModal, then hands off to the picker for whichever card was chosen. No
 * side effects of its own — each branch below owns its own modal and store call. Resolving
 * to null (cancelled, or dismissed) ends the flow.
 *
 * Two dialogs deep by design: the card grid is step one of the same shape Import and Export
 * use, so the workspace asks the question the same way the rest of the app does.
 */
async function handleAddContent(): Promise<void> {
  const choice = await modal.open<AddContentChoice>(AddContentModal)

  switch (choice) {
    case 'tracks':
      await handleAddTracks()
      break
    case 'playlist':
      await handleAddPlaylistToWorkspace()
      break
    case 'new':
      await handleCreatePlaylist()
      break
  }
}

async function handleAddPlaylistToWorkspace(): Promise<void> {
  const result = await modal.open<number[]>(PlaylistSelectModal, { mode: 'export' })
  if (result && Array.isArray(result)) {
    for (const id of result) {
      await workspaceStore.addPlaylist(id)
    }
  }
}

/**
 * Add library tracks to the workspace without assigning them to a playlist.
 *
 * Opens TrackSelectModal with the workspace's current track IDs excluded, so the picker only
 * offers genuine additions — that exclusion replaces the "no new tracks" pre-check the
 * original spec described. Side effect: extends the workspace buffer via the store.
 */
async function handleAddTracks(): Promise<void> {
  const selectedIds = await modal.open<string[]>(TrackSelectModal, {
    excludeIds: [...workspaceStore.tracks.keys()],
    confirmLabel: 'Add',
    confirmVariant: 'primary',
  })
  if (!selectedIds?.length) return
  await workspaceStore.addTracksToWorkspace(selectedIds)
}

async function handleCreatePlaylist(): Promise<void> {
  const name = await modal.open<string>(PromptModal, {
    title: 'New Playlist',
    label: 'Playlist name',
    initialValue: '',
    confirmLabel: 'Create',
  })
  if (name?.trim()) {
    workspaceStore.createEmptyPlaylist(name.trim())
  }
}

// ─── Keyboard shortcuts ────────────────────

useKeyboardShortcuts({
  'cmd+s': (e) => { e.preventDefault(); void handleSave() },
  'cmd+a': (e) => { e.preventDefault(); rowSelection.selectAll() },
  'escape': () => { rowSelection.clear() },
  'cmd+delete': () => { if (rowSelection.selectedCount.value > 0) void handleBulkDelete() },
  'cmd+backspace': () => { if (rowSelection.selectedCount.value > 0) void handleBulkDelete() },
})
</script>

<template>
  <!-- no-text-select covers the whole view, not just the rows: the sticky table header and
       the control bar are just as easy to catch on a drag that starts over the list. -->
  <div class="workspace no-text-select">
    <!-- Header -->
    <header class="workspace__header">

      <button class="btn btn--secondary" @click="goBack">Back to Dashboard</button>
      <h1 class="workspace__title">{{ workspaceStore.sessionName || 'Workspace' }}</h1>

      <!-- Stats display, not crucial -->
      <span class="workspace__meta text-muted">
        {{ workspaceStore.playlists.length }} playlists · {{ workspaceStore.trackList.length }} tracks
      </span>
      <!-- Save section. Content actions live in the control bar, beside the list they act on. -->
      <div class="workspace__header-actions">
        <!-- Unsaved indicator or last-saved time, never both. -->
        <span v-if="workspaceStore.hasUnsavedChanges" class="workspace__unsaved-indicator">
          Unsaved changes
        </span>
        <span v-else-if="lastSavedTime" class="workspace__saved-indicator text-muted">
          Saved at {{ lastSavedTime }}
        </span>
        <button
          class="btn btn--primary"
          :disabled="!workspaceStore.hasUnsavedChanges"
          @click="handleSave"
        >
          Save
        </button>
      </div>
    </header>

    <!-- Error Display -->
    <div v-if="workspaceStore.error" class="workspace__error">
      <p>{{ workspaceStore.error }}</p>
      <button class="btn btn--primary" @click="goBack">Back to Dashboard</button>
    </div>

    <!-- Loading Display -->
    <div v-else-if="workspaceStore.isLoading" class="workspace__loading">
      <p>Loading session...</p>
    </div>

    <!-- Main Workspace Table -->
    <div v-else class="workspace__main">

      <!-- Control Bar. Left holds what the list currently is — search, sort, and the counts
           those two change. Right holds what can be done to it. -->
      <!-- FUTURE: Extract to separate module? -->
      <ControlBar class="workspace__control-bar">
        <SearchBar v-model="query" placeholder="Search tracks…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />

        <!-- Track Count: shown tracks, qualified by the unfiltered total while searching -->
        <span class="text-muted text-sm">
          {{ displayTracks.length }}{{ query ? ` of ${workspaceStore.trackList.length}` : '' }} tracks
        </span>
        <span v-if="rowSelection.selectedCount.value > 0" class="workspace__selection-count">
          {{ rowSelection.selectedCount.value }} selected
          <button class="btn btn--ghost btn--sm" @click="rowSelection.clear()">Clear</button>
        </span>

        <template #actions>
          <button class="btn btn--secondary workspace__add-btn" @click="handleAddContent">
            + Add
          </button>
        </template>
      </ControlBar>

      <!-- Scroll container for the virtualized table -->
      <div ref="scrollContainer" class="workspace__body">

        <!-- Table with CSS-variable-driven column template shared by header and rows -->
        <div class="workspace__table" :style="{ '--ws-col-template': columnTemplate }">

          <!-- Workspace Table Header: Titles for info columns and playlist titles  -->
          <div class="workspace__table-header">
            <div class="workspace__th workspace__th--index">#</div>
            <div class="workspace__th workspace__th--track">Track</div>

            <!-- Playlist columns: one PlaylistColumnHeader per playlist -->
            <PlaylistColumnHeader
              v-for="pl in workspaceStore.playlists"
              :key="pl.id"
              :playlist="pl"
              @request-menu="buildColumnMenu"
            />
          </div>

          <!-- Workspace Table Body: virtualized list of TrackRow components, one per track in displayTracks -->
          <!-- FUTURE: Key field can facilitate column specific styling/actions like row coloring and locking-->
          <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
            <TrackRow
              v-for="row in virtualizer.getVirtualItems()"
              :key="trackAt(row.index).trackID"
              :track="trackAt(row.index)"
              :index="row.index"
              :playlists="workspaceStore.playlists"
              :selected="rowSelection.isSelected(trackAt(row.index).trackID)"
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }"
              @toggle-track="workspaceStore.toggleTrack"
              @select="handleRowSelect"
              @context-menu="handleTrackContextMenu"
            />
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.workspace__header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  z-index: 10;
}

.workspace__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.workspace__header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.workspace__unsaved-indicator {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.workspace__saved-indicator {
  font-size: var(--font-size-sm);
}

.workspace__error,
.workspace__loading {
  padding: var(--space-8) var(--space-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

/* Wrapper for control bar + scroll area */
.workspace__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.workspace__control-bar {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.workspace__body {
  flex: 1;
  overflow: auto;
  position: relative;
}

/* CSS variable scope: --ws-col-template is set inline on this element */
.workspace__table {
  min-width: fit-content;
}

.workspace__table-header {
  position: sticky;
  top: 0;
  display: grid;
  grid-template-columns: var(--ws-col-template);
  align-items: center;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  z-index: 5;
}

.workspace__th {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace__th--index {
  text-align: center;
  color: var(--color-text-muted);
}

.workspace__th--track {
  min-width: 0;
}

.workspace__selection-count {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>

