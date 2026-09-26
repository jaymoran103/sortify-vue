<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { Track, WorkspacePlaylist } from '@/types/models'

// Experiment: a VS Code style overview of the whole workspace. One square tile per track
// per playlist, accent where the track is in the playlist. Tiles shrink until the whole
// list fits the minimap's height. Past MIN_SIDE they stop shrinking, and the map scrolls
// in step with the table instead, as VS Code's does.

const props = defineProps<{
  tracks: Track[]
  playlists: WorkspacePlaylist[]
  scrollEl: HTMLElement | null
  rowHeight: number
}>()

const MIN_SIDE = 2
const MAX_SIDE = 16
const MAX_WIDTH = 120
// Tiles at least this big get a 1px gap, so each reads as its own square.
const GAP_FROM = 5
// How long the minimap stays bright after the last scroll event.
const ACTIVE_MS = 1200

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const height = ref(0)

// Side of one tile. Fit the full height if possible, never wider than MAX_WIDTH overall.
const side = computed(() => {
  const n = Math.max(1, props.playlists.length)
  const fit = props.tracks.length ? height.value / props.tracks.length : MAX_SIDE
  return Math.max(MIN_SIDE, Math.min(fit, MAX_WIDTH / n, MAX_SIDE))
})
const width = computed(() => Math.max(1, props.playlists.length) * side.value)
const contentHeight = computed(() => props.tracks.length * side.value)
const mapHeight = computed(() => Math.min(contentHeight.value, height.value))

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

// When the map is taller than its box, slide it by the table's scroll fraction so the
// top and bottom of both line up.
const offset = computed(() => {
  const overflow = contentHeight.value - mapHeight.value
  const range = scrollHeight.value - clientHeight.value
  return overflow > 0 && range > 0 ? (scrollTop.value / range) * overflow : 0
})

const viewport = computed(() => {
  const firstRow = scrollTop.value / props.rowHeight
  const visibleRows = Math.max(0, clientHeight.value - headerHeight.value) / props.rowHeight
  const h = Math.max(4, Math.min(mapHeight.value, visibleRows * side.value))
  const top = Math.min(Math.max(0, firstRow * side.value - offset.value), mapHeight.value - h)
  return { top, height: h }
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

// Redraw whenever size, scroll, tracks or membership change. Reading trackIdSet.has inside
// the effect is what subscribes it to toggles.
watchEffect(() => {
  const w = width.value
  const h = mapHeight.value
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

  const s = side.value
  const tile = s >= GAP_FROM ? s - 1 : s
  const top = offset.value
  // Only rows inside the box get drawn.
  const first = Math.floor(top / s)
  const last = Math.min(props.tracks.length, Math.ceil((top + h) / s))
  ctx.fillStyle = getComputedStyle(el).getPropertyValue('--color-accent').trim() || 'green'

  for (let i = first; i < last; i++) {
    const id = props.tracks[i]!.trackID
    const y = i * s - top
    props.playlists.forEach((pl, col) => {
      if (pl.trackIdSet.has(id)) ctx.fillRect(col * s, y, tile, tile)
    })
  }
})

// Click or drag centres the table on the track under the pointer.
function scrollToPointer(e: PointerEvent) {
  const el = props.scrollEl
  if (!el || !root.value || !side.value) return
  const y = e.clientY - root.value.getBoundingClientRect().top
  const row = (y + offset.value) / side.value
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
    <canvas ref="canvas" class="minimap__canvas" :style="{ width: `${width}px`, height: `${mapHeight}px` }" />
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
