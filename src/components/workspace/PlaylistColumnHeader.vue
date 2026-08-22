<script setup lang="ts">
import { initials } from '@/utils/initials'
import type { WorkspacePlaylist, PlaylistId } from '@/types/models'

// Presentational only. The menu this header opens depends on state the header does not
// own — search-filter counts, the active sort, Spotify URIs — so WorkspaceView builds it
// and this component just reports that one was requested (design decision D1).
// A collapsed column is one square cell wide, so its header shows only initials.
const props = defineProps<{
  playlist: WorkspacePlaylist
  expanded: boolean
}>()

const emit = defineEmits<{
  requestMenu: [playlistId: PlaylistId, event: MouseEvent]
  toggleExpand: [playlistId: PlaylistId]
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
  <!-- Left-click anywhere else on it toggles the column open or closed. -->
  <div
    class="playlist-col-header"
    :class="{ 'playlist-col-header--collapsed': !expanded }"
    @click="emit('toggleExpand', playlist.id)"
    @contextmenu.prevent="onMenu"
  >
    <!-- The toggle is a real button for keyboard users. It has no handler of its own: its
         click bubbles to the header, which does the toggling. -->
    <button class="playlist-col-header__toggle" type="button" :aria-expanded="expanded">
      <!-- Collapsed: initials, with the full name as tooltip and for screen readers. An empty
           playlist keeps its warning here too, in colour and in words. -->
      <span
        v-if="!expanded"
        class="playlist-col-header__initials"
        :class="{ 'playlist-col-header__initials--empty': playlist.trackIDs.length === 0 }"
        :title="playlist.name"
      >
        <span aria-hidden="true">{{ initials(playlist.name) }}</span>
        <span class="sr-only">
          {{ playlist.name }}{{ playlist.trackIDs.length === 0 ? ', empty' : '' }}
        </span>
      </span>
      <!-- Name over count. Stacked in their own column so the ellipsis button below stays a
           flex sibling on the right rather than being pushed down. -->
      <span v-else class="playlist-col-header__text">
        <!-- Playlist Title. Wraps up to three lines; see .playlist-col-header__name. -->
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
      </span>
    </button>
    <!-- Ellipsis button: expanded columns only, revealed on header hover. -->
    <!-- Also triggered by right-click anywhere on the header. -->
    <button
      v-if="expanded"
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
  /* Tall enough for name over count in both states, so opening a column does not push
     the rows down. */
  min-height: calc(
    (var(--font-size-sm) + var(--font-size-xs)) * var(--line-height-normal) + 2 * var(--space-2)
  );
}

.playlist-col-header:hover {
  background: var(--color-border-subtle);
}

/* Safe centring: short initials sit centred, long ones start at the left edge and are
   clipped on the right, so the first letters always show. */
.playlist-col-header--collapsed {
  justify-content: safe center;
  padding: var(--space-2) var(--space-1);
}

.playlist-col-header__initials {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: clip;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.playlist-col-header__initials--empty {
  color: var(--color-warning);
}

/* A bare button: it exists for focus and Enter/Space, not for looks. */
.playlist-col-header__toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: inherit;
  padding: 0;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.playlist-col-header__toggle:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
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

/* A long name wraps onto more lines rather than ellipsising, and the header row grows to
   fit. Three lines is the cap. Past that it clamps, and the tooltip has the rest. */
.playlist-col-header__name {
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow-wrap: anywhere;
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
