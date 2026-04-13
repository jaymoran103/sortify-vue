<script setup lang="ts">
import type { Track } from '@/types/models'
import type { WorkspacePlaylist } from '@/types/models'


defineProps<{
  track: Track
  index: number
  playlists: WorkspacePlaylist[]
}>()

defineEmits<{
  toggleTrack: [playlistId: number | string, trackId: string]
}>()

</script>

<template>
  <div class="track-row">
    <!-- Index Cell: just display the track's position in the displayed order -->
    <div class="track-row__index">{{ index + 1 }}</div>

    <!-- Info Cell: display track title and artist. FUTURE: display album name here? Currently omitted for visual simplicity -->
    <div class="track-row__info">
      <span class="track-row__title">{{ track.title }}</span>
      <span class="track-row__artist text-muted">{{ track.artist }}</span>
      <!-- <span class="track-row__artist text-muted">{{ track.artist + " • " + track.album }}</span> -->
    </div>

    <!-- Playlist Checkbox Cells: one rendered per playlist column, reflecting membership.  -->
    <!-- @change emits toggleTrack with playlist ID and track ID, parent component handles membership update -->
    <!-- FUTURE: clicking cell (outside of checkbox) should trigger the same action -->
    <div
      v-for="pl in playlists"
      :key="pl.id"
      class="track-row__checkbox"
    >
      <input
        type="checkbox"
        :checked="pl.trackIdSet.has(track.trackID)"
        @change="$emit('toggleTrack', pl.id!, track.trackID)"
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
}

.track-row__index {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.track-row__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 0 var(--space-2);
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
  text-align: center;
}
</style>
