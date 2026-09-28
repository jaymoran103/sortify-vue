<script setup lang="ts">
import type { Track } from '@/types/models'
import type { WorkspacePlaylist } from '@/types/models'

const props = defineProps<{
  track: Track
  index: number
  playlists: WorkspacePlaylist[]
  selected: boolean
}>()

const emit = defineEmits<{
  toggleTrack: [playlistId: number | string, trackId: string]
  select: [trackId: string, event: MouseEvent]
  contextMenu: [trackId: string, event: MouseEvent]
}>()

function toggle(playlistId: number | string): void {
  emit('toggleTrack', playlistId, props.track.trackID)
}
</script>

<template>
  <!-- Shift-click extends the document selection before any handler runs, and user-select
       does not stop it — so a shift-click on a row is denied its default outright. -->
  <div
    class="track-row"
    :class="{ 'track-row--selected': selected }"
    @mousedown.shift.prevent
    @click="$emit('select', track.trackID, $event)"
    @contextmenu.prevent="$emit('contextMenu', track.trackID, $event)"
  >
    <!-- Index Cell: just display the track's position in the displayed order -->
    <div class="track-row__index">{{ index + 1 }}</div>

    <!-- Info Cell: display track title, artist, and hover affordance for track actions. -->
    <div class="track-row__info">
      <div class="track-row__info-content">
        <span class="track-row__title">{{ track.title }}</span>
        <div class="track-row__meta">
          <span class="track-row__artist text-muted">{{ track.artist }}</span>
          <span class="track-row__album text-muted">{{ track.album }}</span>
        </div>
      </div>
      <button
        class="track-row__menu-btn"
        type="button"
        aria-label="Track actions"
        @click.stop="$emit('contextMenu', track.trackID, $event)"
      >
        ⋮
      </button>
    </div>

    <!-- Playlist Checkbox Cells: one rendered per playlist column, reflecting membership. -->
    <!-- The whole cell is the checkbox: pure accent when checked, background when not. -->
    <!-- Clicking anywhere in the cell toggles membership. -->
    <!-- The div's @click.stop handles clicks outside the checkbox and stops row-selection bubbling. -->
    <!-- The input's @click.stop prevents the click from also reaching the div (would double-fire). -->
    <!-- The input's @change handles the actual toggle when the checkbox itself is clicked. -->
    <div
      v-for="pl in playlists"
      :key="pl.id"
      class="track-row__checkbox"
      :class="{ 'track-row__checkbox--checked': pl.trackIdSet.has(track.trackID) }"
      @click.stop="toggle(pl.id!)"
    >
      <!-- Visually hidden, but kept for keyboard focus and screen readers. -->
      <input
        type="checkbox"
        class="sr-only"
        :checked="pl.trackIdSet.has(track.trackID)"
        @change="toggle(pl.id!)"
        @click.stop
        :aria-label="`${track.title} in ${pl.name}`"
      />
    </div>
  </div>
</template>

<style scoped>
.track-row {
  display: grid;
  grid-template-columns: var(--ws-col-template);
  align-items: center;
  height: 48px;
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: default;
  /* Text selection is suppressed for the whole view by .no-text-select on the workspace root. */
}

.track-row:hover {
  background: var(--color-track-row-hover);
}

.track-row--selected {
  background: var(--color-row-selected);
}

.track-row--selected:hover {
  background: var(--color-row-selected);
}

.track-row__index {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.track-row__info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  padding: 0 var(--space-2);
}

.track-row__info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.track-row__menu-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 0 var(--space-1);
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.track-row:hover .track-row__menu-btn,
.track-row__menu-btn:focus-visible {
  opacity: 1;
}

.track-row__menu-btn:hover {
  color: var(--color-text);
}

/* Lighten alternating rows: currently disabled. FUTURE: Make optional via a prop or constant */
/* .track-row:nth-child(even) {
  background: var(--color-surface-raised, var(--color-surface));
} */

.track-row__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-row__artist {
  font-size: var(--font-size-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.track-row__album {
  font-size: var(--font-size-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.track-row__album::before {
  content: '\A0\B7\A0';
}

.track-row__meta {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  min-width: 0;
  overflow: hidden;
}

.track-row__checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  text-align: center;
  cursor: pointer;
}

/* Neighbouring tiles are split by a line as thin as the row border. The line sits inside
   the column width, so the grid does not shift. */
.track-row__checkbox + .track-row__checkbox {
  border-left: 1px solid var(--color-border-subtle);
}

/* Hover lightens a 4px inner edge rather than the whole cell, so at rest every cell is
   pure background or pure accent. */
.track-row__checkbox:hover {
  box-shadow: inset 0 0 0 4px var(--color-cell-hover-edge);
}

.track-row__checkbox--checked {
  background: var(--color-accent);
}

.track-row__checkbox--checked:hover {
  box-shadow: inset 0 0 0 4px var(--color-accent-hover);
}

/* The input is hidden, so its focus ring is drawn on the cell instead. */
.track-row__checkbox:has(input:focus-visible) {
  box-shadow: inset 0 0 0 2px var(--color-focus-ring);
}
</style>
