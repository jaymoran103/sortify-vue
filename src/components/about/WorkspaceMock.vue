<script setup lang="ts">
import { computed, ref } from 'vue'
import TrackRow from '@/components/workspace/TrackRow.vue'
import PlaylistColumnHeader from '@/components/workspace/PlaylistColumnHeader.vue'
import { useListSelection } from '@/composables/useListSelection'
import type { PlaylistId, Track, WorkspacePlaylist } from '@/types/models'

// A live workspace built from the workspace's own TrackRow and PlaylistColumnHeader, on
// local state only. Tiles toggle, headers expand and drag, rows select. No menu ever opens:
// the ⋮ buttons only show that each row and column will have one.

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
</script>

<template>
  <div class="ws-mock no-text-select">
    <div class="ws-header">
      <span class="ws-title">Blues Session</span>
      <span class="ws-meta">{{ playlists.length }} playlists · {{ tracks.length }} tracks</span>
      <div class="ws-header-actions">
        <span class="ws-unsaved">{{ dirty ? 'Unsaved changes' : `Saved at ${savedAt}` }}</span>
        <button class="btn btn--sm" :class="dirty ? 'btn--primary' : 'btn--secondary'" :disabled="!dirty" @click="save">
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
  </div>
</template>

<style scoped>
@import './mock-shared.css';

.ws-mock { display: flex; flex-direction: column; }

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
