<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { Track, WorkspacePlaylist } from '@/types/models'

// Experiment: a VS Code style overview of the whole workspace. One stripe per playlist,
// one line per track, accent where the track is in the playlist. The full track list is
// squeezed into the minimap's height, so it always shows the entire shape at once.

const props = defineProps<{
  tracks: Track[]
  playlists: WorkspacePlaylist[]
  scrollEl: HTMLElement | null
  rowHeight: number
}>()

const COLUMN_WIDTH = 10
const COLUMN_GAP = 2
const MAX_WIDTH = 120
// How long the minimap stays bright after the last scroll event.
const ACTIVE_MS = 1200

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const height = ref(0)

const width = computed(() => {
  const n = props.playlists.length
  return Math.min(MAX_WIDTH, Math.max(COLUMN_WIDTH, n * (COLUMN_WIDTH + COLUMN_GAP) - COLUMN_GAP))
})

// Track scroll position as plain refs so the viewport box reacts to it.
const scrollTop = ref(0)
const scrollHeight = ref(0)
const clientHeight = ref(0)
const active = ref(false)
const dragging = ref(false)
let idleTimer: ReturnType<typeof setTimeout> | undefined

function readScroll() {
  const el = props.scrollEl
  if (!el) return
  scrollTop.value = el.scrollTop
  scrollHeight.value = el.scrollHeight
  clientHeight.value = el.clientHeight
}

function onScroll() {
  readScroll()
  active.value = true
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => (active.value = false), ACTIVE_MS)
}

watch(
  () => props.scrollEl,
  (el, prev) => {
    prev?.removeEventListener('scroll', onScroll)
    el?.addEventListener('scroll', onScroll, { passive: true })
    readScroll()
  },
  { immediate: true },
)

// Filtering or adding tracks changes the scroll height without a scroll event.
watch(
  () => props.tracks.length,
  () => nextTick(readScroll),
)

// The table is a sticky header over the rows, so whatever scroll height the rows do not
// account for is the header. Rows under it are hidden, so it comes off the visible count.
const headerHeight = computed(() =>
  Math.max(0, scrollHeight.value - props.tracks.length * props.rowHeight),
)
const lineHeight = computed(() => (props.tracks.length ? height.value / props.tracks.length : 0))

const viewport = computed(() => {
  const firstRow = scrollTop.value / props.rowHeight
  const visibleRows = Math.max(0, clientHeight.value - headerHeight.value) / props.rowHeight
  const top = firstRow * lineHeight.value
  const h = Math.min(height.value - top, visibleRows * lineHeight.value)
  return { top, height: Math.max(h, 4) }
})

const showsAll = computed(() => scrollHeight.value <= clientHeight.value)

let observer: ResizeObserver | undefined
onMounted(() => {
  if (!root.value || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([entry]) => {
    height.value = entry!.contentRect.height
    readScroll()
  })
  observer.observe(root.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  props.scrollEl?.removeEventListener('scroll', onScroll)
  clearTimeout(idleTimer)
})

// Redraw whenever size, tracks or membership change. Reading trackIdSet.has inside the
// effect is what subscribes it to toggles.
watchEffect(() => {
  const w = width.value
  const h = height.value
  const el = canvas.value
  // Nothing to draw before the first measure, which also keeps jsdom off getContext.
  if (!el || !h) return
  const ctx = el.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  el.width = Math.round(w * dpr)
  el.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const n = props.playlists.length
  if (!n || !props.tracks.length) return

  const colW = (w - COLUMN_GAP * (n - 1)) / n
  const line = lineHeight.value
  ctx.fillStyle = getComputedStyle(el).getPropertyValue('--color-accent').trim() || 'green'

  props.playlists.forEach((pl, col) => {
    const x = col * (colW + COLUMN_GAP)
    // Merge consecutive members into one rect: fewer draws and no seams between lines.
    let runStart = -1
    props.tracks.forEach((t, i) => {
      const member = pl.trackIdSet.has(t.trackID)
      if (member && runStart < 0) runStart = i
      if (!member && runStart >= 0) {
        ctx.fillRect(x, runStart * line, colW, (i - runStart) * line)
        runStart = -1
      }
    })
    if (runStart >= 0) ctx.fillRect(x, runStart * line, colW, (props.tracks.length - runStart) * line)
  })
})

// Click or drag centres the table on the track under the pointer.
function scrollToPointer(e: PointerEvent) {
  const el = props.scrollEl
  if (!el || !root.value || !lineHeight.value) return
  const y = e.clientY - root.value.getBoundingClientRect().top
  const row = y / lineHeight.value
  const visibleRows = Math.max(0, el.clientHeight - headerHeight.value) / props.rowHeight
  el.scrollTop = (row - visibleRows / 2) * props.rowHeight
}

function onPointerDown(e: PointerEvent) {
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  scrollToPointer(e)
}

function onPointerMove(e: PointerEvent) {
  if (dragging.value) scrollToPointer(e)
}

function onPointerUp() {
  dragging.value = false
}
</script>

<template>
  <div
    ref="root"
    class="minimap"
    :class="{ 'minimap--active': active || dragging }"
    :style="{ width: `${width}px` }"
    aria-hidden="true"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <canvas ref="canvas" class="minimap__canvas" :style="{ width: `${width}px`, height: `${height}px` }" />
    <div
      v-if="!showsAll && tracks.length"
      class="minimap__viewport"
      :style="{ top: `${viewport.top}px`, height: `${viewport.height}px` }"
    />
  </div>
</template>

<style scoped>
.minimap {
  position: relative;
  flex-shrink: 0;
  margin: var(--space-1) var(--space-2);
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.2s;
  touch-action: none;
}

.minimap:hover,
.minimap--active {
  opacity: 1;
}

.minimap__canvas {
  display: block;
}

.minimap__viewport {
  position: absolute;
  left: -3px;
  right: -3px;
  background: color-mix(in srgb, var(--color-text) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-text) 35%, transparent);
  pointer-events: none;
}
</style>
