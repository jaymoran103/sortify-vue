<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import {
  TRACK_COLUMN_MAX_WIDTH_PX,
  TRACK_COLUMN_MIN_WIDTH_PX,
  type TrackColumn,
  type TrackColumnKey,
} from './trackColumns'

// Header for one optional track column. A click sorts by it, and dragging its right edge
// resizes it. WorkspaceView owns the sort and the widths. This only reports.
const props = defineProps<{
  column: TrackColumn
  // Whether this column drives the sort, and which way.
  sort: 'asc' | 'desc' | null
}>()

const emit = defineEmits<{
  sort: [key: TrackColumnKey]
  resize: [key: TrackColumnKey, widthPx: number]
}>()

// Resize. The handle stays put in the DOM, so it can hold pointer capture for the drag.
const resizing = ref(false)
let startX = 0
let startWidth = 0

function onResizeStart(event: PointerEvent): void {
  if (event.button !== 0) return
  resizing.value = true
  startX = event.clientX
  startWidth = props.column.widthPx
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd)
  window.addEventListener('pointercancel', onResizeEnd)
}

function onResizeMove(event: PointerEvent): void {
  const width = Math.round(startWidth + event.clientX - startX)
  const clamped = Math.min(TRACK_COLUMN_MAX_WIDTH_PX, Math.max(TRACK_COLUMN_MIN_WIDTH_PX, width))
  if (clamped !== props.column.widthPx) emit('resize', props.column.key, clamped)
}

function onResizeEnd(): void {
  resizing.value = false
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  window.removeEventListener('pointercancel', onResizeEnd)
}

onBeforeUnmount(onResizeEnd)
</script>

<template>
  <div
    class="track-col-header"
    :class="[`track-col-header--${column.key}`, { 'track-col-header--resizing': resizing }]"
    :aria-sort="sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'"
  >
    <!-- A real button, so the sort works from the keyboard too. -->
    <button class="track-col-header__sort" type="button" @click="emit('sort', column.key)">
      <span class="truncate">{{ column.label }}</span>
      <span v-if="sort" class="track-col-header__arrow" aria-hidden="true">
        {{ sort === 'asc' ? '▲' : '▼' }}
      </span>
    </button>
    <!-- Drag handle on the right edge. Its clicks never reach the sort button. -->
    <div
      class="track-col-header__resize"
      aria-hidden="true"
      @pointerdown.stop.prevent="onResizeStart"
      @click.stop
    />
  </div>
</template>

<style scoped>
/* Split like the playlist headers: a 2px line on the left, full header height. */
.track-col-header {
  position: relative;
  align-self: stretch;
  display: flex;
  min-width: 0;
  border-left: 2px solid var(--color-border-subtle);
}

.track-col-header:hover {
  background: var(--color-border-subtle);
}

.track-col-header__sort {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.track-col-header--duration .track-col-header__sort {
  justify-content: flex-end;
}

.track-col-header__sort:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: -2px;
}

.track-col-header__arrow {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

/* Sits inside the column's right edge, just left of the next column's line. */
.track-col-header__resize {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  touch-action: none;
}

.track-col-header__resize:hover,
.track-col-header--resizing .track-col-header__resize {
  background: var(--color-accent-subtle);
}
</style>
