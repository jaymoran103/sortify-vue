<script setup lang="ts">
import type { WorkspacePlaylist, PlaylistId } from '@/types/models'

// Presentational only. The menu this header opens depends on state the header does not
// own — search-filter counts, the active sort, Spotify URIs — so WorkspaceView builds it
// and this component just reports that one was requested (design decision D1).
const props = defineProps<{
  playlist: WorkspacePlaylist
}>()

const emit = defineEmits<{
  requestMenu: [playlistId: PlaylistId, event: MouseEvent]
}>()

/**
 * Report a menu request to the parent, passing the originating event so the parent
 * can position the menu at the cursor. Bound to both the ellipsis button and right-click.
 */
function onMenu(event: MouseEvent): void {
  emit('requestMenu', props.playlist.id, event)
}
</script>

<template>
  <!-- Right-click anywhere on the header requests the menu at the cursor position. -->
  <div class="playlist-col-header" @contextmenu.prevent="onMenu">
    <!-- Name over count. Stacked in their own column so the ellipsis button below stays a
         flex sibling on the right rather than being pushed down. -->
    <div class="playlist-col-header__text">
      <!-- Playlist Title. FUTURE: Find solution for long playlist names in tight displays -->
      <span class="playlist-col-header__name" :title="playlist.name">
        {{ playlist.name }}
      </span>
      <!-- An empty column is marked here, continuously, rather than sprung at exit. The
           leave dialog only repeats it as a footnote, and only if it opened anyway. -->
      <span
        class="playlist-col-header__count"
        :class="{ 'playlist-col-header__count--empty': playlist.trackIDs.length === 0 }"
      >
        <!-- Not aria-hidden: the glyph is what carries the warning to a screen reader,
             since colour alone does not. -->
        <span v-if="playlist.trackIDs.length === 0">⚠</span>
        {{ playlist.trackIDs.length }} track{{ playlist.trackIDs.length === 1 ? '' : 's' }}
      </span>
    </div>
    <!-- Ellipsis button: hidden by default, revealed on header hover. -->
    <!-- Also triggered by right-click anywhere on the header. -->
    <button
      class="playlist-col-header__menu-btn"
      aria-label="Playlist actions"
      @click.stop="onMenu"
    >
      ⋮
    </button>
  </div>
</template>

<style scoped>
.playlist-col-header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  width: 100%;
  overflow: hidden;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.1s;
}

.playlist-col-header:hover {
  background: var(--color-border-subtle);
}

/* Stacks name over count. min-width: 0 lets the name ellipsise instead of forcing
   the flex row wider than the column. */
.playlist-col-header__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.playlist-col-header__name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.playlist-col-header__count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.playlist-col-header__count--empty {
  color: var(--color-warning);
}

/* Ellipsis button: hidden until the column header is hovered. */
/* Opacity-based so keyboard focus still works naturally. */
.playlist-col-header__menu-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
}

.playlist-col-header:hover .playlist-col-header__menu-btn {
  opacity: 1;
}

.playlist-col-header__menu-btn:hover {
  color: var(--color-text);
}
</style>
