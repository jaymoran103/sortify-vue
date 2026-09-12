<script setup lang="ts">
import { computed } from 'vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import { packCluster } from '@/similarity/circlePack'
import type { ContainmentCluster } from '@/similarity/containment'

const props = defineProps<{
  clusters: ContainmentCluster[]
  selectedKey: string
}>()

const emit = defineEmits<{
  select: [key: string]
  selectPlaylist: [playlistId: number]
}>()

/** Square viewBox. The SVG scales to its container; this is only the coordinate space. */
const SIDE = 480

/** Below this radius a label cannot be read, so the circle relies on its hover title instead. */
const LABEL_MIN_RADIUS = 22

/** Below this, a leaf has no room for a second line, so the count is dropped from the label. */
const COUNT_MIN_RADIUS = 30

/**
 * Average advance width of the 11px label face, in user units.
 *
 * Measured rather than guessed: an earlier budget assumed 3.6 and produced labels almost twice
 * their circle's width, which is what made a dozen siblings collide.
 */
const CHAR_WIDTH = 7.2

/** Where a container's label sits, as a fraction of its radius above centre. */
const RIM_OFFSET = 0.93

/** Fraction of a leaf's diameter a label may use, leaving margin inside the curve. */
const LEAF_WIDTH = 1.5

/** A label shorter than this is not worth drawing; the hover title carries the name instead. */
const MIN_LABEL_CHARS = 4

/** Height of the label's box above its baseline, in user units. Its top corners bound the fit. */
const LABEL_ASCENT = 9

const selected = computed(
  () => props.clusters.find((cluster) => cluster.key === props.selectedKey) ?? props.clusters[0],
)

const circles = computed(() => (selected.value ? packCluster(selected.value.roots, SIDE) : []))

const clusterOptions = computed({
  get: () => selected.value?.key ?? '',
  set: (key: string) => emit('select', key),
})

/**
 * Cluster labels name the largest root and the size of the group, since a cluster has no name of
 * its own. Depth is called out because it is the thing that makes a map worth looking at.
 */
const options = computed(() =>
  props.clusters.map((cluster) => {
    const lead = cluster.roots[0]?.name ?? 'Cluster'
    const nesting = cluster.depth >= 3 ? `, ${cluster.depth} deep` : ''
    return { key: cluster.key, label: `${lead} — ${cluster.playlistCount} playlists${nesting}` }
  }),
)

const coverage = computed(() => {
  const cluster = selected.value
  if (!cluster || cluster.totalTracks === 0) return ''
  const percent = Math.round((cluster.coveredTracks / cluster.totalTracks) * 100)
  return `${cluster.coveredTracks} of ${cluster.totalTracks} tracks covered by what sits inside (${percent}%)`
})

const simplified = computed(() => {
  const count = selected.value?.multiParentCount ?? 0
  if (count === 0) return ''
  return `${count} playlist${count === 1 ? '' : 's'} also sit inside other containers, and are drawn once under the smallest.`
})

/** Deeper circles read as lighter, so nesting is legible without relying on the outline alone. */
function fillFor(depth: number): string {
  const strength = Math.min(6 + depth * 7, 28)
  return `color-mix(in srgb, var(--color-accent) ${strength}%, transparent)`
}

function titleFor(circle: { name: string; size: number; otherContainerCount: number }): string {
  const base = `${circle.name} — ${circle.size} tracks`
  if (circle.otherContainerCount === 0) return base
  const n = circle.otherContainerCount
  return `${base} (also inside ${n} other container${n === 1 ? '' : 's'})`
}

/**
 * How many characters fit on a circle's label line.
 *
 * A container's label sits near the top edge, where the available chord is far narrower than the
 * diameter: at RIM_OFFSET of the radius the half-chord is r·sqrt(1 − offset²), about 0.37r. Using
 * the full width there is what pushed rim labels outside their own circles.
 */
function labelBudget(r: number, onRim: boolean): number {
  if (!onRim) return Math.floor((r * LEAF_WIDTH) / CHAR_WIDTH)

  // The binding constraint is the box's top corners, not its baseline: they sit LABEL_ASCENT
  // higher, where the chord is narrower. Measuring at the baseline is what let the root's label
  // run past its own edge.
  const offset = Math.min(1, RIM_OFFSET + LABEL_ASCENT / r)
  const halfChord = r * Math.sqrt(Math.max(0, 1 - offset * offset))
  return Math.floor((2 * halfChord * 0.95) / CHAR_WIDTH)
}

/** Trims a name to what fits, leaving room for any suffix drawn on the same line. */
function labelFor(name: string, r: number, onRim: boolean, suffixLength = 0): string {
  const budget = labelBudget(r, onRim) - suffixLength
  if (budget < MIN_LABEL_CHARS) return ''
  return name.length <= budget ? name : `${name.slice(0, budget - 1)}…`
}

/** A container carries its count on the same line; a leaf puts it underneath. */
function suffixFor(circle: { size: number; hasChildren: boolean }): string {
  return circle.hasChildren ? ` · ${circle.size}` : ''
}

/** True when there is room to draw anything legible at all. */
function hasLabel(circle: { name: string; size: number; r: number; hasChildren: boolean }): boolean {
  if (circle.r < LABEL_MIN_RADIUS) return false
  return labelFor(circle.name, circle.r, circle.hasChildren, suffixFor(circle).length) !== ''
}

/** The whole string a circle displays inline. */
function labelText(circle: {
  name: string
  size: number
  r: number
  hasChildren: boolean
}): string {
  const suffix = suffixFor(circle)
  return labelFor(circle.name, circle.r, circle.hasChildren, suffix.length) + suffix
}

/**
 * Width to hold a rim label to, so it cannot spill past its own circle.
 *
 * The character-width estimate above is only ever approximate — real glyph advances vary by
 * string — so the drawn text is pinned to the budgeted width and compressed if the font runs
 * wider. Truncation already keeps that width inside the chord, making overflow impossible rather
 * than merely unlikely.
 */
function labelWidth(circle: { name: string; size: number; r: number; hasChildren: boolean }): number {
  return labelText(circle).length * CHAR_WIDTH
}

/**
 * Where a circle's label sits.
 *
 * A container's interior belongs to its children, so its label goes in the ring between its own
 * edge and theirs. Children occupy 86% of the radius, so the ring is 14% deep; the label is
 * centred in it and clamped so it never rides the stroke itself. Leaves keep their middle.
 */
function labelY(circle: { y: number; r: number; hasChildren: boolean }): number {
  if (!circle.hasChildren) return circle.y + 4
  return circle.y - circle.r * RIM_OFFSET
}
</script>

<template>
  <div class="containment-map">
    <div v-if="clusters.length === 0" class="containment-map__empty text-muted">
      No playlist is fully inside another. Containment needs every track of one playlist to appear
      in the other.
    </div>

    <template v-else>
      <div class="containment-map__controls">
        <SelectDropdown
          v-model="clusterOptions"
          :options="options"
          title="Which group of nested playlists to show"
        />
        <span class="containment-map__coverage text-muted text-xs">{{ coverage }}</span>
      </div>

      <!--
        Full containment means there are no partial-overlap crescents to draw: an inner playlist's
        tracks are entirely inside the outer's, so the Venn degenerates into nested circles.
        Circle area follows track count, but siblings are scaled to fit their parent, so the
        covered figure above is the number to trust rather than the eye.
      -->
      <svg
        class="containment-map__svg"
        :viewBox="`0 0 ${SIDE} ${SIDE}`"
        role="img"
        aria-label="Nested circles showing which playlists are fully contained by others"
      >
        <g
          v-for="circle in circles"
          :key="circle.playlistId"
          class="containment-map__node"
          @click="emit('selectPlaylist', circle.playlistId)"
        >
          <circle
            class="containment-map__circle"
            :class="{ 'containment-map__circle--shared': circle.otherContainerCount > 0 }"
            :cx="circle.x"
            :cy="circle.y"
            :r="circle.r"
            :fill="fillFor(circle.depth)"
          >
            <title>{{ titleFor(circle) }}</title>
          </circle>

          <text
            v-if="hasLabel(circle)"
            class="containment-map__label"
            :class="{ 'containment-map__label--rim': circle.hasChildren }"
            :x="circle.x"
            :y="labelY(circle)"
            text-anchor="middle"
            :textLength="circle.hasChildren ? labelWidth(circle) : undefined"
            :lengthAdjust="circle.hasChildren ? 'spacingAndGlyphs' : undefined"
          >{{ labelText(circle) }}<tspan
              v-if="!circle.hasChildren && circle.r >= COUNT_MIN_RADIUS"
              class="containment-map__count"
              :x="circle.x"
              dy="13"
            >{{ circle.size }}</tspan></text>
        </g>
      </svg>

      <!--
        The legend states what size means and, just as importantly, what it does not. Siblings are
        scaled to fit their parent, so area is comparable within a container but not across the
        whole drawing; the numbers on the circles and the coverage line are the authority.
      -->
      <div class="containment-map__legend text-muted text-xs">
        <span class="containment-map__legend-item">
          <svg class="containment-map__swatch" viewBox="0 0 40 18" aria-hidden="true">
            <circle cx="7" cy="9" r="4" />
            <circle cx="24" cy="9" r="8" />
          </svg>
          bigger circle, more tracks
        </span>
        <span class="containment-map__legend-item">
          <svg class="containment-map__swatch" viewBox="0 0 22 18" aria-hidden="true">
            <circle cx="11" cy="9" r="8" />
            <circle cx="11" cy="9" r="3.5" />
          </svg>
          inside means every track is in the outer playlist
        </span>
        <span class="containment-map__legend-item">
          <svg class="containment-map__swatch" viewBox="0 0 22 18" aria-hidden="true">
            <circle class="containment-map__swatch-dashed" cx="11" cy="9" r="7" />
          </svg>
          dashed: also inside another container
        </span>
      </div>

      <p class="containment-map__scale-note text-muted text-xs">
        Sizes are comparable within a container, not across the whole map — each group is scaled to
        fit its parent. The number on each circle is its track count.
      </p>

      <p v-if="simplified" class="containment-map__note text-muted text-xs">{{ simplified }}</p>
    </template>
  </div>
</template>

<style scoped>
.containment-map {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-height: 0;
  padding: var(--space-3);
  overflow-y: auto;
}

.containment-map__controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.containment-map__coverage {
  min-width: 0;
}

.containment-map__svg {
  width: 100%;
  max-width: 520px;
  height: auto;
  align-self: center;
}

.containment-map__node {
  cursor: pointer;
}

.containment-map__circle {
  stroke: var(--color-accent);
  stroke-width: 1;
  transition: stroke-width var(--duration-fast) var(--ease-default);
}

.containment-map__node:hover .containment-map__circle {
  stroke-width: 2.5;
}

/* Dashed where the tree is a simplification: this playlist sits inside others too. */
.containment-map__circle--shared {
  stroke-dasharray: 4 3;
}

.containment-map__label {
  fill: var(--color-text);
  font-size: 11px;
  font-family: var(--font-family);
  pointer-events: none;
  /* A halo in the page colour, so a label stays readable wherever geometry crowds it. */
  stroke: var(--color-bg);
  stroke-width: 3px;
  paint-order: stroke fill;
}

.containment-map__label--rim {
  font-weight: var(--font-weight-semibold);
}

.containment-map__count {
  fill: var(--color-text-muted);
  font-size: 10px;
}

.containment-map__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: center;
}

.containment-map__legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.containment-map__swatch {
  height: 18px;
  flex-shrink: 0;
}

.containment-map__swatch circle {
  fill: color-mix(in srgb, var(--color-accent) 14%, transparent);
  stroke: var(--color-accent);
  stroke-width: 1;
}

.containment-map__swatch-dashed {
  stroke-dasharray: 4 3;
}

.containment-map__scale-note {
  margin: 0;
  max-width: 56ch;
}

.containment-map__empty,
.containment-map__note {
  margin: 0;
  padding: var(--space-2) 0;
}
</style>
