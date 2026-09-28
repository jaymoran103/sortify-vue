<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
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
  move: [playlistId: PlaylistId, direction: -1 | 1]
  dragEnd: [playlistId: PlaylistId]
}>()

// Drag to reorder. A press becomes a drag only past DRAG_THRESHOLD_PX, so a plain click
// still toggles the column. Listeners sit on window, not pointer capture, because the
// header's element moves in the DOM each time the column hops.
const DRAG_THRESHOLD_PX = 4
const root = ref<HTMLElement | null>(null)
const dragging = ref(false)
const canMoveLeft = ref(false)
const canMoveRight = ref(false)
let startX = 0
let pressed = false
// The click that ends a drag must not also toggle the column.
let suppressClick = false

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  // A drag that ended off the header left no click to eat. Clear the flag here.
  suppressClick = false
  pressed = true
  startX = event.clientX
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

// Hop one column once the pointer passes a neighbour's midpoint. Only playlist headers
// count as neighbours, so the column never crosses into the track column.
function onPointerMove(event: PointerEvent): void {
  if (!pressed || !root.value) return
  if (!dragging.value) {
    if (Math.abs(event.clientX - startX) < DRAG_THRESHOLD_PX) return
    dragging.value = true
  }
  const next = playlistHeader(root.value.nextElementSibling)
  const prev = playlistHeader(root.value.previousElementSibling)
  // Chevrons mark the sides the column can still move to. They trail a hop by one event.
  canMoveLeft.value = prev !== null
  canMoveRight.value = next !== null
  if (next && event.clientX > midpoint(next)) {
    emit('move', props.playlist.id, 1)
  } else if (prev && event.clientX < midpoint(prev)) {
    emit('move', props.playlist.id, -1)
  }
}

function playlistHeader(el: Element | null): Element | null {
  return el?.classList.contains('playlist-col-header') ? el : null
}

function onPointerUp(): void {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  pressed = false
  if (!dragging.value) return
  dragging.value = false
  suppressClick = true
  emit('dragEnd', props.playlist.id)
}

function midpoint(el: Element): number {
  const rect = el.getBoundingClientRect()
  return rect.left + rect.width / 2
}

function onClick(): void {
  if (suppressClick) {
    suppressClick = false
    return
  }
  emit('toggleExpand', props.playlist.id)
}

onBeforeUnmount(onPointerUp)

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
  <!-- Press and drag sideways to move the column. -->
  <div
    ref="root"
    class="playlist-col-header"
    :class="{
      'playlist-col-header--collapsed': !expanded,
      'playlist-col-header--dragging': dragging,
    }"
    @pointerdown="onPointerDown"
    @click="onClick"
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
    <!-- While dragging, chevrons mark the sides the column can move to. -->
    <template v-if="dragging">
      <span
        v-if="canMoveLeft"
        class="playlist-col-header__chevron playlist-col-header__chevron--left"
        aria-hidden="true"
      >‹</span>
      <span
        v-if="canMoveRight"
        class="playlist-col-header__chevron playlist-col-header__chevron--right"
        aria-hidden="true"
      >›</span>
    </template>
  </div>
</template>

<style scoped>
.playlist-col-header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  position: relative;
  width: 100%;
  /* Fills the header row's height, so the lines between headers run top to bottom. */
  align-self: stretch;
  overflow: hidden;
  cursor: pointer;
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

/* Neighbouring headers are split like the cells below them. */
.playlist-col-header + .playlist-col-header {
  border-left: 2px solid var(--color-border-subtle);
}

.playlist-col-header__chevron {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-accent);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  pointer-events: none;
}

.playlist-col-header__chevron--left {
  left: 2px;
}

.playlist-col-header__chevron--right {
  right: 2px;
}

.playlist-col-header--dragging,
.playlist-col-header--dragging .playlist-col-header__toggle {
  cursor: grabbing;
}

/* :hover here too, or the grey hover wins while the pointer sits on the dragged header.
   No transition, so a hop does not fade the tint in and out. */
.playlist-col-header--dragging,
.playlist-col-header--dragging:hover {
  background: var(--color-accent-subtle);
  transition: none;
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
