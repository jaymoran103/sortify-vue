<!-- A time-scaled SVG chart: stacked areas or plain lines, with a hover crosshair and tooltip.
     Points sit at their real dates, so uneven gaps between snapshots show as uneven spacing. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { niceTicks } from '@/utils/librarySnapshot'
import type { ChartPoint, ChartSeries } from '@/types/history'

const props = withDefaults(defineProps<{
  series: ChartSeries[]
  points: ChartPoint[]
  stacked?: boolean
  height?: number
  summary: string           // screen-reader description of the chart
}>(), { stacked: false, height: 240 })

const MARGIN = { top: 12, bottom: 28, left: 48 }
const LABEL_GUTTER = 128      // right margin that holds direct labels
const DIRECT_LABEL_MAX = 4    // more series than this rely on the legend alone
const SURFACE = '#272727'     // --color-surface; SVG strokes below need a concrete value

const root = ref<HTMLDivElement | null>(null)
const width = ref(640)
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!root.value) return
  width.value = root.value.clientWidth || width.value
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(240, entry.contentRect.width)
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

const directLabels = computed(() => props.series.length <= DIRECT_LABEL_MAX && width.value >= 480)
const right = computed(() => (directLabels.value ? LABEL_GUTTER : 16))
const innerW = computed(() => Math.max(40, width.value - MARGIN.left - right.value))
const innerH = computed(() => props.height - MARGIN.top - MARGIN.bottom)

// Cumulative tops per point: stacks[p][s] is the top of series s at point p.
const stacks = computed(() => props.points.map((p) => {
  let run = 0
  return p.values.map((v) => (props.stacked ? (run += v) : v))
}))

const yTicks = computed(() => {
  const max = Math.max(0, ...stacks.value.flat())
  return niceTicks(max)
})
const yMax = computed(() => yTicks.value[yTicks.value.length - 1] ?? 1)

const tMin = computed(() => props.points[0]?.t ?? 0)
const tMax = computed(() => props.points[props.points.length - 1]?.t ?? 0)
const single = computed(() => props.points.length === 1 || tMax.value === tMin.value)

function x(t: number): number {
  if (single.value) return MARGIN.left + innerW.value / 2
  return MARGIN.left + ((t - tMin.value) / (tMax.value - tMin.value)) * innerW.value
}
function y(v: number): number {
  return MARGIN.top + innerH.value - (v / yMax.value) * innerH.value
}

const xs = computed(() => props.points.map((p) => x(p.t)))

// One path per series. Stacked: a band from the series below up to this one.
const paths = computed(() => props.series.map((s, si) => {
  const top = xs.value.map((px, pi) => `${px},${y(stacks.value[pi]![si]!)}`)
  if (!props.stacked) return { key: s.key, color: s.color, line: `M${top.join('L')}`, area: '' }
  const bottom = xs.value.map((px, pi) => `${px},${y(si === 0 ? 0 : stacks.value[pi]![si - 1]!)}`).reverse()
  return { key: s.key, color: s.color, line: `M${top.join('L')}`, area: `M${top.join('L')}L${bottom.join('L')}Z` }
}))

// A lone snapshot has no span to fill, so it draws as one stacked column.
const BAR_W = 28
const singleBars = computed(() => {
  if (!single.value || !props.stacked || props.points.length === 0) return []
  const last = stacks.value.length - 1
  return props.series.map((s, si) => {
    const lo = si === 0 ? 0 : stacks.value[last]![si - 1]!
    const hi = stacks.value[last]![si]!
    return { key: s.key, color: s.color, x: x(tMax.value) - BAR_W / 2, y: y(hi), h: Math.max(0, y(lo) - y(hi)) }
  })
})

const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const numFmt = new Intl.NumberFormat()

// Label snapshots from the newest back, skipping any that would sit within 80px of a kept
// label. Snapshots cluster unevenly in time, so spacing is by position, not by index.
const TICK_GAP = 80
const xTicks = computed(() => {
  const spanYears = new Date(tMax.value).getFullYear() !== new Date(tMin.value).getFullYear()
  const fmt = spanYears ? dateFmt : shortFmt
  const picked: { x: number; label: string }[] = []
  for (let i = props.points.length - 1; i >= 0; i--) {
    const px = xs.value[i]!
    if (picked.length && picked[0]!.x - px < TICK_GAP) continue
    picked.unshift({ x: px, label: fmt.format(props.points[i]!.t) })
  }
  return picked
})

// Direct labels at the last point: band middle when stacked, line end otherwise.
// Spread apart so no two overlap; a stacked band too thin to read gets no label.
const labels = computed(() => {
  if (!directLabels.value || props.points.length === 0) return []
  const last = stacks.value[stacks.value.length - 1]!
  const rows = props.series.map((s, si) => {
    const top = y(last[si]!)
    const bottom = props.stacked ? y(si === 0 ? 0 : last[si - 1]!) : top
    return { key: s.key, label: s.label, color: s.color, y: (top + bottom) / 2, thin: props.stacked && bottom - top < 10 }
  }).filter((r) => !r.thin).sort((a, b) => a.y - b.y)
  for (let i = 1; i < rows.length; i++) rows[i]!.y = Math.max(rows[i]!.y, rows[i - 1]!.y + 14)
  return rows
})
const labelX = computed(() => (single.value ? x(tMax.value) + BAR_W / 2 : MARGIN.left + innerW.value) + 10)

// Hover: nearest snapshot by x.
const hover = ref<number | null>(null)
function onMove(e: PointerEvent): void {
  const svg = e.currentTarget as SVGElement
  const px = e.clientX - svg.getBoundingClientRect().left
  let best = 0
  xs.value.forEach((v, i) => { if (Math.abs(v - px) < Math.abs(xs.value[best]! - px)) best = i })
  hover.value = props.points.length ? best : null
}

const tooltip = computed(() => {
  const i = hover.value
  if (i === null || !props.points[i]) return null
  const p = props.points[i]
  const rows = props.series.map((s, si) => ({ ...s, value: p.values[si] ?? 0 }))
  const px = xs.value[i]!
  return {
    x: px,
    flip: px > width.value * 0.6,
    date: dateFmt.format(p.t),
    rows: props.stacked ? rows.reverse() : rows,
    total: props.stacked ? p.values.reduce((a, b) => a + b, 0) : null,
    dots: props.series.map((s, si) => ({ key: s.key, color: s.color, y: y(stacks.value[i]![si]!) })),
  }
})
</script>

<template>
  <div ref="root" class="ts-chart">
    <div v-if="series.length > 1" class="ts-chart__legend">
      <span v-for="s in series" :key="s.key" class="ts-chart__legend-item">
        <span class="ts-chart__swatch" :style="{ background: s.color }" />{{ s.label }}
      </span>
    </div>

    <svg
      :width="width"
      :height="height"
      role="img"
      :aria-label="summary"
      @pointermove="onMove"
      @pointerleave="hover = null"
    >
      <!-- Grid and y axis -->
      <g class="ts-chart__grid">
        <line
          v-for="t in yTicks" :key="t"
          :x1="MARGIN.left" :x2="MARGIN.left + innerW" :y1="y(t)" :y2="y(t)"
          :class="t === 0 ? 'ts-chart__baseline' : 'ts-chart__gridline'"
        />
        <text
          v-for="t in yTicks" :key="`l${t}`"
          :x="MARGIN.left - 8" :y="y(t)" class="ts-chart__tick" text-anchor="end" dominant-baseline="middle"
        >{{ numFmt.format(t) }}</text>
      </g>

      <!-- X axis: one tick per labelled snapshot -->
      <g>
        <text
          v-for="t in xTicks" :key="t.x"
          :x="t.x" :y="height - 8" class="ts-chart__tick" text-anchor="middle"
        >{{ t.label }}</text>
      </g>

      <!-- Marks -->
      <template v-if="stacked && single">
        <rect
          v-for="b in singleBars" :key="b.key"
          :x="b.x" :y="b.y" :width="BAR_W" :height="b.h" :fill="b.color"
          :stroke="SURFACE" stroke-width="2"
        />
      </template>
      <template v-else-if="stacked">
        <path v-for="p in paths" :key="`a${p.key}`" :d="p.area" :fill="p.color" />
        <!-- A surface-colored edge on each band keeps neighbours apart -->
        <path v-for="p in paths" :key="`e${p.key}`" :d="p.line" fill="none" :stroke="SURFACE" stroke-width="2" />
      </template>
      <template v-else>
        <path v-for="p in paths" :key="`l${p.key}`" :d="p.line" fill="none" :stroke="p.color" stroke-width="2" stroke-linejoin="round" />
        <template v-for="(p, si) in paths" :key="`m${p.key}`">
          <circle
            v-for="(px, pi) in xs" :key="pi"
            :cx="px" :cy="y(stacks[pi]![si]!)" r="4" :fill="p.color" :stroke="SURFACE" stroke-width="2"
          />
        </template>
      </template>

      <!-- Direct labels -->
      <g v-if="labels.length">
        <template v-for="l in labels" :key="`d${l.key}`">
          <rect :x="labelX" :y="l.y - 4" width="8" height="8" :fill="l.color" />
          <text :x="labelX + 14" :y="l.y" class="ts-chart__direct" dominant-baseline="middle">{{ l.label }}</text>
        </template>
      </g>

      <!-- Hover layer -->
      <g v-if="tooltip" pointer-events="none">
        <line :x1="tooltip.x" :x2="tooltip.x" :y1="MARGIN.top" :y2="MARGIN.top + innerH" class="ts-chart__crosshair" />
        <circle
          v-for="d in tooltip.dots" :key="d.key"
          :cx="tooltip.x" :cy="d.y" r="4" :fill="d.color" :stroke="SURFACE" stroke-width="2"
        />
      </g>
      <rect
        :x="MARGIN.left - 12" :y="MARGIN.top" :width="innerW + 24" :height="innerH"
        fill="transparent"
      />
    </svg>

    <div
      v-if="tooltip"
      class="ts-chart__tooltip"
      :class="{ 'ts-chart__tooltip--flip': tooltip.flip }"
      :style="{ left: `${tooltip.x}px` }"
    >
      <div class="ts-chart__tooltip-date">{{ tooltip.date }}</div>
      <div v-for="r in tooltip.rows" :key="r.key" class="ts-chart__tooltip-row">
        <span class="ts-chart__swatch" :style="{ background: r.color }" />
        <span class="ts-chart__tooltip-label">{{ r.label }}</span>
        <span class="ts-chart__tooltip-value">{{ numFmt.format(r.value) }}</span>
      </div>
      <div v-if="tooltip.total !== null" class="ts-chart__tooltip-row ts-chart__tooltip-total">
        <span class="ts-chart__tooltip-label">Total</span>
        <span class="ts-chart__tooltip-value">{{ numFmt.format(tooltip.total) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ts-chart {
  position: relative;
  width: 100%;
}

.ts-chart svg {
  display: block;
  overflow: visible;
}

.ts-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin-bottom: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.ts-chart__legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.ts-chart__swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.ts-chart__gridline {
  stroke: var(--color-border-subtle);
  stroke-width: 1;
}

.ts-chart__baseline {
  stroke: var(--gray-500);
  stroke-width: 1;
}

.ts-chart__tick {
  fill: var(--color-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.ts-chart__direct {
  fill: var(--color-text);
  font-size: 11px;
}

.ts-chart__crosshair {
  stroke: var(--color-text-muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.ts-chart__tooltip {
  position: absolute;
  top: var(--space-6);
  transform: translateX(12px);
  min-width: 180px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-xs);
  pointer-events: none;
  z-index: var(--z-dropdown);
}

.ts-chart__tooltip--flip {
  transform: translateX(calc(-100% - 12px));
}

.ts-chart__tooltip-date {
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.ts-chart__tooltip-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  line-height: 1.6;
}

.ts-chart__tooltip-label {
  flex: 1;
  color: var(--color-text);
}

.ts-chart__tooltip-value {
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}

.ts-chart__tooltip-total {
  border-top: 1px solid var(--color-border-subtle);
  margin-top: var(--space-1);
  padding-top: var(--space-1);
}
</style>
