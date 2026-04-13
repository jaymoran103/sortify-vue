<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useWorkspaceStore } from '@/stores/workspace'
import { useModal } from '@/composables/useModal'
import { useListFilter } from '@/composables/useListFilter'
import { useListSort } from '@/composables/useListSort'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import ControlBar from '@/components/common/ControlBar.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import TrackRow from './TrackRow.vue'
import PlaylistColumnHeader from './PlaylistColumnHeader.vue'
import type { Track } from '@/types/models'
import type { SortOption } from '@/types/ui'

const route = useRoute()
const router = useRouter()
const workspaceStore = useWorkspaceStore()
const modal = useModal()

// Sort options for workspace tracks.
// NOTE: Album is currenrly omitted since it's not displayed in the track rows, but remains fully functional.
const sortOptions: SortOption<Track>[] = [
  { key: 'order-added', label: 'Order Added', compareFn: () => 0 },
  { key: 'title', label: 'Title', compareFn: (a, b) => a.title.localeCompare(b.title) },
  { key: 'artist', label: 'Artist', compareFn: (a, b) => a.artist.localeCompare(b.artist) },
  // { key: 'album', label: 'Album', compareFn: (a, b) => a.album.localeCompare(b.album) },
]

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

// Before navigating away from the workspace, check for unsaved changes and warn user if necessary.
onBeforeRouteLeave(async (_to, _from, next) => {

  // If there are no unsaved changes, reset the store and navigate away.
  if (!workspaceStore.hasUnsavedChanges) {
    workspaceStore.$reset()
    next()
    return
  }

  // Build and show confirmation modal if there are unsaved changes, await user response.
  // FUTURE: Give option to save changes here as well.
  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Leave without saving?',
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

function goBack(): void {
  router.push('/')
}

// Handle save action: call the store's save method, which persists the session to IndexedDB.
async function handleSave(): Promise<void> {
  await workspaceStore.save()
}

// Helper to get track at a given virtualizer row index from the filtered+sorted displayTracks list.
function trackAt(index: number): Track {
  const track = displayTracks.value[index]
  if (!track) throw new Error(`No track at index ${index}`)
  return track
}

// ─── Playlist column action handlers ────────────────────────────────────────

async function handleRename(playlistId: number | string): Promise<void> {
  const pl = workspaceStore.playlists.find((p) => p.id === playlistId)
  if (!pl) return
  // FUTURE: window.prompt is a temporary scaffold, replace with a proper modal in a polish pass
  const newName = window.prompt('Rename playlist:', pl.name)
  if (newName && newName.trim()) {
    workspaceStore.renamePlaylist(playlistId, newName.trim())
  }
}

function handleRemove(playlistId: number | string): void {
  workspaceStore.removePlaylist(playlistId)
}

function handleDuplicate(playlistId: number | string): void {
  workspaceStore.duplicatePlaylist(playlistId)
}
</script>

<template>
  <div class="workspace">
    <!-- Header -->
    <header class="workspace__header">

      <button class="btn btn--secondary" @click="goBack">Back to Dashboard</button>
      <h1 class="workspace__title">{{ workspaceStore.sessionName || 'Workspace' }}</h1>

      <!-- Stats display, not crucial -->
      <span class="workspace__meta text-muted">
        {{ workspaceStore.playlists.length }} playlists · {{ workspaceStore.trackList.length }} tracks
      </span>
      <!-- Actions/Save Section -->
      <div class="workspace__header-actions">
        <span v-if="workspaceStore.hasUnsavedChanges" class="workspace__unsaved-indicator">
          Unsaved changes
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

      <!-- Control Bar: search, sort, track count -->
      <!-- FUTURE: Extract to separate module? --> 
      <ControlBar class="workspace__control-bar">
        <SearchBar v-model="query" placeholder="Search tracks…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />

        <!-- Track Count: display number of shown tracks, out of total -->
        <template #actions>
          <span class="text-muted text-sm">
            {{ displayTracks.length }}{{ query ? ` of ${workspaceStore.trackList.length}` : '' }} tracks
          </span>
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
              v-for="(pl, i) in workspaceStore.playlists"
              :key="pl.id"
              :playlist="pl"
              :can-move-left="i > 0"
              :can-move-right="i < workspaceStore.playlists.length - 1"
              @rename="handleRename"
              @remove="handleRemove"
              @duplicate="handleDuplicate"
              @move-left="(id) => workspaceStore.movePlaylist(id, -1)"
              @move-right="(id) => workspaceStore.movePlaylist(id, 1)"
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
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }"
              @toggle-track="workspaceStore.toggleTrack"
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
</style>

