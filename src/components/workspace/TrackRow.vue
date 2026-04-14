<script setup lang="ts">
import type { Track } from '@/types/models'
import type { WorkspacePlaylist } from '@/types/models'

defineProps<{
  track: Track
  index: number
  playlists: WorkspacePlaylist[]
  selected: boolean
}>()

defineEmits<{
  toggleTrack: [playlistId: number | string, trackId: string]
  select: [trackId: string, event: MouseEvent]
  contextMenu: [trackId: string, event: MouseEvent]
}>()
</script>

<template>
  <div
    class="track-row"
    :class="{ 'track-row--selected': selected }"
    @click="$emit('select', track.trackID, $event)"
    @contextmenu.prevent="$emit('contextMenu', track.trackID, $event)"
  >
    <!-- Index Cell: just display the track's position in the displayed order -->
    <div class="track-row__index">{{ index + 1 }}</div>

    <!-- Info Cell: display track title, artist, and hover affordance for track actions. -->
    <div class="track-row__info">
      <div class="track-row__info-content">
        <span class="track-row__title">{{ track.title }}</span>
        <span class="track-row__artist text-muted">{{ track.artist }}</span>
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
    <!-- Clicking anywhere in the cell toggles membership. -->
    <!-- The div's @click.stop handles clicks outside the checkbox and stops row-selection bubbling. -->
    <!-- The input's @click.stop prevents the click from also reaching the div (would double-fire). -->
    <!-- The input's @change handles the actual toggle when the checkbox itself is clicked. -->
    <div
      v-for="pl in playlists"
      :key="pl.id"
      class="track-row__checkbox"
      @click.stop="$emit('toggleTrack', pl.id!, track.trackID)"
    >
      <input
        type="checkbox"
        :checked="pl.trackIdSet.has(track.trackID)"
        @change="$emit('toggleTrack', pl.id!, track.trackID)"
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
  user-select: none;
}

.track-row:hover {
  background: var(--color-row-hover);
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
}

.track-row__checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  text-align: center;
  cursor: pointer;
  transition: background 0.1s;
}

.track-row__checkbox:hover {
  background: var(--color-cell-checkbox-hover);
}
</style>
