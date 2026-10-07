<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import TrackRow from '@/components/workspace/TrackRow.vue'
import PlaylistColumnHeader from '@/components/workspace/PlaylistColumnHeader.vue'
import { useListSelection } from '@/composables/useListSelection'
import type { PlaylistId, Track, WorkspacePlaylist } from '@/types/models'

// A live workspace built from the workspace's own TrackRow and PlaylistColumnHeader, on
// local state only. Tiles toggle, headers expand and drag, rows select. No menu ever opens:
// the ⋮ buttons only show that each row and column will have one.
// Hovering a tab beside the demo plays that tab's action on it. Any press in the demo stops it.

const props = defineProps<{ activeTab: number }>()

// Same sizes as WorkspaceView, so tiles are square and expanded headers read the same.
const ROW_HEIGHT = 48
const COLLAPSED_COLUMN_PX = ROW_HEIGHT
const EXPANDED_COLUMN_PX = 140
const INDEX_COLUMN_PX = 60
// Demo titles are short, so the track column is narrow and the grid sits close to them.
const TRACK_COLUMN_PX = 210

const tracks: Track[] = [
  { trackID: 't1', title: 'The Thrill Is Gone',    artist: 'B.B. King',          album: 'Completely Well',       source: 'generated' },
  { trackID: 't2', title: 'Boom Boom',             artist: 'John Lee Hooker',    album: "Burnin'",               source: 'generated' },
  { trackID: 't3', title: 'Born Under a Bad Sign', artist: 'Albert King',        album: 'Born Under a Bad Sign', source: 'generated' },
  { trackID: 't4', title: 'Born Under a Bad Sign', artist: 'Jimi Hendrix',       album: 'Blues',                 source: 'generated' },
  { trackID: 't5', title: 'Hey Joe',               artist: 'Jimi Hendrix',       album: 'Are You Experienced',   source: 'generated' },
  { trackID: 't6', title: 'Pride and Joy',         artist: 'Stevie Ray Vaughan', album: 'Texas Flood',           source: 'generated' },
  { trackID: 't7', title: 'La Grange',             artist: 'ZZ Top',             album: 'Tres Hombres',          source: 'generated' },
]

function playlist(id: number, name: string, trackIDs: string[]): WorkspacePlaylist {
  return { id, name, trackIDs, trackIdSet: new Set(trackIDs), origin: 'library' }
}

const playlists = ref<WorkspacePlaylist[]>([
  playlist(1, 'Blues Rock',    ['t4', 't5', 't6', 't7']),
  playlist(2, 'Classic Blues', ['t1', 't2', 't3']),
  playlist(3, 'Blues Covers',  ['t4', 't5']),
  playlist(4, 'Guitar Riffs',  ['t2', 't5', 't6', 't7']),
])

// ── Membership and save state ──
const dirty = ref(false)
const savedAt = ref(new Date().toLocaleTimeString())

function toggleTrack(playlistId: PlaylistId, trackId: string): void {
  const pl = playlists.value.find((p) => p.id === playlistId)
  if (!pl) return
  if (pl.trackIdSet.has(trackId)) {
    pl.trackIdSet.delete(trackId)
    pl.trackIDs = pl.trackIDs.filter((id) => id !== trackId)
  } else {
    pl.trackIdSet.add(trackId)
    pl.trackIDs = [...pl.trackIDs, trackId]
  }
  dirty.value = true
}

function save(): void {
  if (!dirty.value) return
  dirty.value = false
  savedAt.value = new Date().toLocaleTimeString()
}

// ── Columns: expand on header click, reorder on drag ──
// One column starts open, so both header states show.
const expandedIds = ref(new Set<PlaylistId>([1]))

function toggleExpand(playlistId: PlaylistId): void {
  if (!expandedIds.value.delete(playlistId)) expandedIds.value.add(playlistId)
}

function movePlaylist(playlistId: PlaylistId, direction: -1 | 1): void {
  const list = playlists.value
  const from = list.findIndex((p) => p.id === playlistId)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length) return
  ;[list[from], list[to]] = [list[to]!, list[from]!]
}

// No trailing 1fr track: the table is as wide as its columns, so it grows and shrinks as
// they open and close. The last 2px track holds the line after the last column.
const columnTemplate = computed(() =>
  [
    `${INDEX_COLUMN_PX}px`,
    `${TRACK_COLUMN_PX}px`,
    ...playlists.value.map((pl) => `${expandedIds.value.has(pl.id) ? EXPANDED_COLUMN_PX : COLLAPSED_COLUMN_PX}px`),
    '2px',
  ].join(' '),
)

// ── Rows: hover lifts a column, click selects as in the workspace ──
const hoveredPlaylistId = ref<PlaylistId | null>(null)
const trackList = ref(tracks)
const rowSelection = useListSelection<Track>(trackList, (t) => t.trackID, { selectMultiple: false })

// Menus are not part of the demo. The ⋮ buttons and right-click do nothing.
function noMenu(): void {}

// ── Tab simulations ──
// Each tab plays a short script through the same functions a click would call. A cue class
// stands in for the pointer: hover on a tile, press on a header or button.
const root = ref<HTMLElement | null>(null)
const showExport = ref(false)
let runId = 0

const tileEl = (row: number, col: number) =>
  root.value?.querySelectorAll('.track-row')[row]?.querySelectorAll('.track-row__checkbox')[col] ?? null
const headerEl = (col: number) => root.value?.querySelectorAll('.playlist-col-header')[col] ?? null

function clearCues(): void {
  root.value?.querySelectorAll('.ws-sim-hover, .ws-sim-press').forEach((el) => el.classList.remove('ws-sim-hover', 'ws-sim-press'))
  hoveredPlaylistId.value = null
}

function stop(): void {
  runId++
  clearCues()
  showExport.value = false
}

/** Waits, then reports whether this run is still the current one. */
function pause(id: number, ms: number): Promise<boolean> {
  return new Promise((resolve) => setTimeout(() => resolve(id === runId), ms))
}

async function simToggle(id: number, row: number, col: number): Promise<boolean> {
  const pl = playlists.value[col]
  if (!pl) return true
  hoveredPlaylistId.value = pl.id
  tileEl(row, col)?.classList.add('ws-sim-hover')
  if (!(await pause(id, 450))) return false
  toggleTrack(pl.id, tracks[row]!.trackID)
  if (!(await pause(id, 450))) return false
  clearCues()
  return true
}

const scripts: Record<number, (id: number) => Promise<unknown>> = {
  // Edit memberships: a few tiles toggled in turn.
  0: async (id) => {
    for (const [row, col] of [[0, 2], [2, 3], [4, 1]] as const) {
      if (!(await simToggle(id, row, col))) return
    }
  },
  // Arrange playlists: the last column dragged two places left, then opened and closed.
  1: async (id) => {
    const moving = playlists.value[playlists.value.length - 1]
    if (!moving) return
    for (let step = 0; step < 2; step++) {
      const index = playlists.value.findIndex((p) => p.id === moving.id)
      headerEl(index)?.classList.add('ws-sim-press')
      if (!(await pause(id, 400))) return
      clearCues()
      movePlaylist(moving.id, -1)
    }
    headerEl(playlists.value.findIndex((p) => p.id === moving.id))?.classList.add('ws-sim-press')
    if (!(await pause(id, 500))) return
    toggleExpand(moving.id)
    if (!(await pause(id, 1200))) return
    toggleExpand(moving.id)
    clearCues()
  },
  // Save & Export: an edit if there is none, then Save, then the export dialog.
  2: async (id) => {
    if (!dirty.value && !(await simToggle(id, 1, 0))) return
    root.value?.querySelector('.ws-mock__save')?.classList.add('ws-sim-press')
    if (!(await pause(id, 500))) return
    save()
    clearCues()
    if (!(await pause(id, 600))) return
    showExport.value = true
  },
}

watch(
  () => props.activeTab,
  (tab) => {
    stop()
    void scripts[tab]?.(runId)
  },
)
onBeforeUnmount(() => runId++)
</script>

<template>
  <div ref="root" class="ws-mock no-text-select" @pointerdown.capture="stop">
    <div class="ws-header">
      <span class="ws-title">Blues Session</span>
      <span class="ws-meta">{{ playlists.length }} playlists · {{ tracks.length }} tracks</span>
      <div class="ws-header-actions">
        <span class="ws-unsaved">{{ dirty ? 'Unsaved changes' : `Saved at ${savedAt}` }}</span>
        <button class="btn btn--sm ws-mock__save" :class="dirty ? 'btn--primary' : 'btn--secondary'" :disabled="!dirty" @click="save">
          Save
        </button>
      </div>
    </div>

    <div class="ws-mock__table" :style="{ '--ws-col-template': columnTemplate }">
      <div class="ws-mock__table-header">
        <div class="ws-mock__th ws-mock__th--index">#</div>
        <div class="ws-mock__th">Track</div>
        <PlaylistColumnHeader
          v-for="pl in playlists"
          :key="pl.id"
          :playlist="pl"
          :expanded="expandedIds.has(pl.id)"
          @request-menu="noMenu"
          @toggle-expand="toggleExpand"
          @move="movePlaylist"
        />
        <div class="ws-mock__th-edge" aria-hidden="true" />
      </div>

      <TrackRow
        v-for="(track, i) in tracks"
        :key="track.trackID"
        :track="track"
        :index="i"
        :playlists="playlists"
        :selected="rowSelection.isSelected(track.trackID)"
        :hovered-playlist-id="hoveredPlaylistId"
        @toggle-track="toggleTrack"
        @select="rowSelection.toggle"
        @context-menu="noMenu"
        @hover-column="hoveredPlaylistId = $event"
      />
    </div>

    <!-- Save & Export: the export dialog, as the dashboard shows it. Any press closes it. -->
    <div v-if="showExport" class="ws-mock__overlay">
      <div class="ws-mock__dialog io-modal">
        <h2 class="io-modal__title">Export</h2>
        <div class="io-modal__body">
          <p class="text-muted text-sm">Where are you exporting to?</p>
          <div class="source-card-grid">
            <button class="source-card" type="button">
              <span class="source-card__label">Local Files</span>
              <span class="source-card__hint">CSV or JSON</span>
            </button>
            <button class="source-card" type="button" disabled>
              <span class="source-card__label">Spotify</span>
              <span class="source-card__hint">Not available yet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './mock-shared.css';

.ws-mock { position: relative; display: flex; flex-direction: column; }

/* Simulation cues, matching the real hover and press looks. */
.ws-mock :deep(.track-row__checkbox.ws-sim-hover) { box-shadow: inset 0 0 0 4px var(--color-cell-hover-edge); }
.ws-mock :deep(.track-row__checkbox--checked.ws-sim-hover) { box-shadow: inset 0 0 0 4px var(--color-accent-hover); }
.ws-mock :deep(.playlist-col-header.ws-sim-press) { background: var(--color-accent-subtle); }
.ws-mock__save.ws-sim-press { box-shadow: 0 0 0 2px var(--color-focus-ring); }

/* Export dialog over the demo */
.ws-mock__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-bg) 60%, transparent);
  z-index: 5;
}
.ws-mock__dialog {
  width: min(420px, calc(100% - 2 * var(--space-4)));
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* Same look as WorkspaceView's table header. */
.ws-mock__table { width: fit-content; max-width: 100%; overflow-x: auto; }
.ws-mock__table-header {
  display: grid;
  grid-template-columns: var(--ws-col-template);
  align-items: center;
  background: var(--color-surface);
  border-bottom: 2px solid var(--color-border-subtle);
}
.ws-mock__th {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}
.ws-mock__th--index { text-align: center; color: var(--color-text-muted); }
.ws-mock__th-edge { align-self: stretch; border-left: 2px solid var(--color-border-subtle); }

/* A hovered row takes a light wash of accent, a little stronger than the workspace's grey lift. */
.ws-mock :deep(.track-row:not(.track-row--selected):hover) {
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-track-row-hover));
}

/* The workspace hides each ⋮ until hover. Here they show dimly at rest, so they read as a feature. */
.ws-mock :deep(.track-row__menu-btn),
.ws-mock :deep(.playlist-col-header__menu-btn) { opacity: 0.35; }
.ws-mock :deep(.track-row:hover .track-row__menu-btn),
.ws-mock :deep(.playlist-col-header:hover .playlist-col-header__menu-btn) { opacity: 1; }
</style>
