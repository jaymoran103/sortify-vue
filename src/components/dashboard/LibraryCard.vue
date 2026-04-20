<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTrackStore } from '@/stores/tracks'
import { usePlaylistStore } from '@/stores/playlists'
import { useModal } from '@/composables/useModal'
import { useContextMenu } from '@/composables/useContextMenu'
import { useDebounce } from '@/composables/useDebounce'
import { useListSort } from '@/composables/useListSort'
import ControlBar from '@/components/common/ControlBar.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import PlaylistSelectModal from '@/components/dashboard/PlaylistSelectModal.vue'
import type { Playlist, Track } from '@/types/models'
import type { SortOption } from '@/types/ui'

const trackStore = useTrackStore()
const playlistStore = usePlaylistStore()
const modal = useModal()
const contextMenu = useContextMenu()

// ── View toggle ──────────────────────────────────────────────────────────────
const activeView = ref<'playlists' | 'tracks'>('playlists')

// ── Search ───────────────────────────────────────────────────────────────────
const query = ref('')
const debouncedQuery = useDebounce(query, 200)

// ── Playlist sort + filter ────────────────────────────────────────────────────
const playlistSortOptions: SortOption<Playlist>[] = [
  { key: 'name-asc',   label: 'Name',      compareFn: (a, b) => a.name.localeCompare(b.name) },
  // { key: 'name-desc',  label: 'Name Z-A',  compareFn: (a, b) => b.name.localeCompare(a.name) },
  { key: 'count-desc', label: 'Size',   compareFn: (a, b) => b.trackIDs.length - a.trackIDs.length },
]

const { currentSort: playlistSort, sorted: sortedPlaylists } = useListSort(
  computed((): Playlist[] => playlistStore.playlists ?? []),
  playlistSortOptions,
)

const filteredPlaylists = computed(() => {
  const q = debouncedQuery.value.trim().toLowerCase()
  if (!q) return sortedPlaylists.value
  return sortedPlaylists.value.filter((p) => p.name.toLowerCase().includes(q))
})

// ── Track sort + filter ───────────────────────────────────────────────────────
const trackSortOptions: SortOption<Track>[] = [
  { key: 'title-asc',  label: 'Title',   compareFn: (a, b) => a.title.localeCompare(b.title) },
  { key: 'artist-asc', label: 'Artist',  compareFn: (a, b) => a.artist.localeCompare(b.artist) },
]

const { currentSort: trackSort, sorted: sortedTracks } = useListSort(
  computed((): Track[] => trackStore.tracks ?? []),
  trackSortOptions,
)

// Filter tracks by title or artist matching the query
const filteredTracks = computed(() => {
  const q = debouncedQuery.value.trim().toLowerCase()
  if (!q) return sortedTracks.value
  return sortedTracks.value.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q),
      // t.album.toLowerCase().includes(q), // FUTURE: Add album option? this would work now, but album field isn't displayed so results may appear confusing
  )
})

// ── Derive active sort/options for template ───────────────────────────────────
const currentSort = computed({
  get: () => (activeView.value === 'playlists' ? playlistSort.value : trackSort.value),
  set: (val) => {
    if (activeView.value === 'playlists') playlistSort.value = val
    else trackSort.value = val
  },
})
const sortOptions = computed(() =>
  activeView.value === 'playlists' ? playlistSortOptions : trackSortOptions,
)

// ── Footer stats ──────────────────────────────────────────────────────────────
const playlistCount = computed(() => (playlistStore.playlists ?? []).length)
const uniqueTrackCount = computed(
  () => new Set((playlistStore.playlists ?? []).flatMap((p) => p.trackIDs)).size,
)
const totalTrackSlots = computed(() =>
  (playlistStore.playlists ?? []).reduce((n, p) => n + p.trackIDs.length, 0),
)

// ── Management actions ────────────────────────────────────────────────────────
async function openDeletePlaylists(): Promise<void> {
  const ids = await modal.open<number[]>(PlaylistSelectModal, { mode: 'delete' })
  if (!ids?.length) return
  await playlistStore.deletePlaylists(ids)
}

// Action handler for "Clear Library" option: destructive action with confirmation modal
async function openClearLibrary(): Promise<void> {
  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Clear Library',
    message: 'This will permanently delete all tracks and playlists. This cannot be undone.',
    confirmLabel: 'Clear everything',
    danger: true,
  })
  if (!confirmed) return
  await trackStore.clearTracks()
  await playlistStore.clearPlaylists()
}

// Open context menu with simple options for library management
function showManagementMenu(event: MouseEvent): void {
  contextMenu.show(event, [
    { label: 'Delete Playlists…', action: openDeletePlaylists },
    { divider: true },
    { label: 'Clear Library…',    action: openClearLibrary },
  ])
}
</script>

<template>
  <div class="dashboard-card library-card">

    <!-- Card Header-->
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Library</h2>

      <!-- View toggle: Playlists / Tracks -->
      <!-- Moved from control bar for better spacing, header may not be a permanent home if 'open' button is reintroduced here -->
      <div class="library-card__view-toggle">
        <button
          class="library-card__toggle-btn"
          :class="{ 'library-card__toggle-btn--active': activeView === 'playlists' }"
          toggle-mode="tracks-playlists"
          @click="activeView = 'playlists'"
        >
          Playlists
        </button>
        <button
          class="library-card__toggle-btn"
          :class="{ 'library-card__toggle-btn--active': activeView === 'tracks' }"
          toggle-mode="tracks-view"
          @click="activeView = 'tracks'"
        >
          Tracks
        </button>
      </div>

      <!-- TODO: Open button is currently hidden; no library tab to navigate to, and track/playlist toggle is a better use of the space -->
      <button 
        class="btn btn--secondary library-card__open-btn" 
        disabled 
        title="Library view coming soon"
        hidden
        >
        Open
      </button>
    </div>


    <!-- Control bar -->
    <ControlBar>
      
      <SearchBar v-model="query" :placeholder="`Filter ${activeView}…`" />
      <SelectDropdown v-model="currentSort" :options="sortOptions" />

      <template #actions>
        <button
          class="btn btn--secondary library-card__menu-btn"
          toggle-mode="management-menu"
          title="Manage library"
          @click="showManagementMenu"
        >
          ⋯
        </button>
      </template>
    </ControlBar>

    <!-- Scroll zone -->
    <div class="dashboard-card__scroll-zone library-card__list">
      <!-- Playlists view -->
      <ScrollableList
        v-if="activeView === 'playlists'"
        :items="filteredPlaylists"
        key-field="id"
        :estimate-size="48"
      >
        <template #item="{ item }">
          <div class="library-card__row">
            <span class="library-card__name">{{ (item as Playlist).name }}</span>
            <span class="library-card__row-end">
              <span class="library-card__meta text-muted text-sm">
                {{ (item as Playlist).trackIDs.length }} tracks
              </span>
            </span>
          </div>
        </template>
        <template #empty>
          <div class="library-card__empty">
            <p class="text-muted" v-if="query">
              No playlists match search "{{ query }}"
            </p>
            <template v-else>
              <p class="text-muted">No playlists yet.</p>
              <p class="text-muted">Import some to get started.</p>
            </template>
          </div>
        </template>
      </ScrollableList>

      <!-- Tracks view -->
      <ScrollableList
        v-else
        :items="filteredTracks"
        key-field="trackID"
        :estimate-size="48"
      >
        <template #item="{ item }">
          <div class="library-card__row">
            <span class="library-card__name">{{ (item as Track).title }}</span>
            <span class="library-card__meta text-muted text-sm">{{ (item as Track).artist }}</span>
          </div>
        </template>
        <template #empty>
          <div class="library-card__empty">
            <p class="text-muted" v-if="query"> No tracks match search "{{ query }}" </p>

            <template v-else>
              <p class="text-muted">No tracks yet.</p>
              <p class="text-muted">Import playlists to get started.</p>
            </template>
          </div>
        </template>
      </ScrollableList>
    </div>

    <!-- Footer stats -->
    <div class="dashboard-card__footer">
      <div class="dashboard-card__stat">
        <span class="dashboard-card__stat-number">{{ playlistCount }}</span>
        <span class="dashboard-card__stat-label">Playlists</span>
      </div>
      <div class="dashboard-card__stat">
        <span class="dashboard-card__stat-number">{{ uniqueTrackCount }}</span>
        <span class="dashboard-card__stat-label">Unique Tracks</span>
      </div>
      <div class="dashboard-card__stat">
        <span class="dashboard-card__stat-number">{{ totalTrackSlots }}</span>
        <span class="dashboard-card__stat-label">Total Tracks</span>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
@import './card.css';

.library-card {
  min-height: 300px;
}

.library-card .control-bar {
  gap: var(--space-2);
  padding: var(--space-2) var(--space-0);
  border-bottom: none;
}

.library-card .control-bar__controls {
  gap: var(--space-1);
  min-width: 0;
  flex: 1;
}

.library-card .search-bar {
  flex: 1;
  min-width: 0;
}

.library-card .search-bar__input {
  min-width: 0;
}

.library-card__open-btn {
  font-size: var(--font-size-sm);
  padding: var(--space-1) var(--space-3);
}

.library-card__list {
  flex: 1;
  min-height: 140px;
}

/* ── View toggle ── */
.library-card__view-toggle {
  display: flex;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.library-card__toggle-btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
}

.library-card__toggle-btn + .library-card__toggle-btn {
  border-left: 1px solid var(--color-border-subtle);
}

.library-card__toggle-btn--active {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

/* ── Management button ── */
.library-card__menu-btn {
  font-size: var(--font-size-lg);
  padding: var(--space-1) var(--space-2);
  line-height: 1;
  letter-spacing: 0.05em;
}

/* ── Rows ── */
.library-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  gap: var(--space-3);
}

.library-card__row:hover {
  background: var(--color-row-hover);
  opacity: 1;
}

.library-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 0;
  min-width: 0;
}

.library-card__meta {
  flex: 0 1 auto;
  min-width: 10ch;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.library-card__row-end {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 0 1 auto;
  min-width: 0;
}

.library-card__empty {
  width: 100%;
  min-height: 5rem;
  padding: var(--space-1);
  text-align: left;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.library-card__list .scrollable-list__empty {
  align-items: flex-start;
  justify-content: flex-start;
  padding: var(--space-4);
}
.library-card__empty p {
  margin: 0 0 var(--space-2);
}
.library-card__empty p:last-child {
  margin-bottom: 0;
}

.dashboard-card__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.dashboard-card__stat-number {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1;
}

.dashboard-card__stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  /* text-transform: uppercase; */
  letter-spacing: 0.06em;
}
</style>
