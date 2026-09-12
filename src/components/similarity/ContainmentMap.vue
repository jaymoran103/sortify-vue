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
const LABEL_MIN_RADIUS = 24

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

/** Trims a name to something that fits the circle it sits in. */
function labelFor(name: string, r: number): string {
  const budget = Math.max(3, Math.floor(r / 3.6))
  return name.length <= budget ? name : `${name.slice(0, budget - 1)}…`
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
            v-if="circle.r >= LABEL_MIN_RADIUS"
            class="containment-map__label"
            :x="circle.x"
            :y="circle.depth === 0 ? circle.y - circle.r + 14 : circle.y"
            text-anchor="middle"
          >
            {{ labelFor(circle.name, circle.r) }}
          </text>
        </g>
      </svg>

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
}

.containment-map__empty,
.containment-map__note {
  margin: 0;
  padding: var(--space-2) 0;
}
</style>
