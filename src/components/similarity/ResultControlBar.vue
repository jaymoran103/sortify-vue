<script setup lang="ts">
import { computed } from 'vue'
import ControlBar from '@/components/common/ControlBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import type {
  DoublesControls,
  EquivalenceStatus,
  OverlapControls,
  ResultMeasure,
} from '@/similarity/types'

const props = defineProps<{
  controls: OverlapControls
  doublesControls: DoublesControls
  measures: ResultMeasure[]
  mode: 'overlap' | 'doubles'
  equivalenceEnabled: boolean
  /** Which result surface is showing. The map reads containment only. */
  resultView: 'table' | 'map'
  /** The map is offered only for the containment reading, where nesting is the whole point. */
  canShowMap: boolean
  /** The toggle only renders once there is something for it to change. */
  hasConfirmedDoubles: boolean
}>()

const emit = defineEmits<{
  update: [patch: Partial<OverlapControls>]
  updateDoubles: [patch: Partial<DoublesControls>]
  updateEquivalence: [enabled: boolean]
  updateView: [view: 'table' | 'map']
}>()

const REVIEW_FILTERS: { key: EquivalenceStatus | 'all'; label: string }[] = [
  { key: 'unconfirmed', label: 'Unreviewed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

const reviewFilter = computed({
  get: () => props.doublesControls.reviewFilter,
  set: (value: string) => emit('updateDoubles', { reviewFilter: value as EquivalenceStatus | 'all' }),
})

const thresholdPercent = computed(() => Math.round(props.controls.threshold * 100))

// Sort options come from the measures the current rows actually carry, which is what stops a
// result being ranked by something the user cannot see. SelectDropdown takes plain key/label
// options and holds no sort logic; the sorting itself happens in the worker.
const sortOptions = computed(() =>
  props.measures.map((measure) => ({ key: measure.key, label: measure.label })),
)

const sortKey = computed({
  get: () => props.controls.sortKey,
  set: (value: string) => emit('update', { sortKey: value }),
})

function onThreshold(event: Event): void {
  const raw = Number((event.target as HTMLInputElement).value)
  emit('update', { threshold: raw / 100 })
}
</script>

<template>
  <ControlBar class="result-control-bar">
    <!-- Doubles has no threshold: a group either matched or it did not. The review filter is the
         control that actually narrows the list. -->
    <SelectDropdown
      v-if="mode === 'doubles'"
      v-model="reviewFilter"
      class="result-control-bar__review-filter"
      :options="REVIEW_FILTERS"
      title="Filter by review state"
    />

    <label v-if="mode === 'overlap'" class="result-control-bar__field">
      <span class="text-muted text-xs">Threshold</span>
      <input
        class="result-control-bar__threshold"
        type="range"
        min="0"
        max="100"
        :value="thresholdPercent"
        @input="onThreshold"
      />
      <span class="result-control-bar__value text-xs">{{ thresholdPercent }}%</span>
    </label>

    <SelectDropdown
      v-if="sortOptions.length > 0"
      v-model="sortKey"
      :options="sortOptions"
      title="Sort results by"
    />

    <!-- Only shown once at least one group is confirmed: a control that changes nothing is
         chrome. It rebuilds the index, so the number it moves is the number on screen. -->
    <label
      v-if="mode === 'overlap' && hasConfirmedDoubles"
      class="result-control-bar__equivalence"
      title="Count confirmed doubles as one track when measuring overlap"
    >
      <input
        class="result-control-bar__equivalence-input"
        type="checkbox"
        :checked="equivalenceEnabled"
        @change="emit('updateEquivalence', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-xs">Treat doubles as one track</span>
    </label>

    <template #actions>
      <div v-if="canShowMap" class="result-control-bar__view">
        <button
          class="result-control-bar__view-btn result-control-bar__view-table"
          :class="{ 'result-control-bar__view-btn--active': resultView === 'table' }"
          @click="emit('updateView', 'table')"
        >
          Table
        </button>
        <button
          class="result-control-bar__view-btn result-control-bar__view-map"
          :class="{ 'result-control-bar__view-btn--active': resultView === 'map' }"
          @click="emit('updateView', 'map')"
        >
          Map
        </button>
      </div>

      <div v-if="mode === 'overlap'" class="result-control-bar__axis">
        <button
          class="result-control-bar__axis-btn result-control-bar__axis-playlist"
          :class="{ 'result-control-bar__axis-btn--active': controls.axis === 'playlist' }"
          @click="emit('update', { axis: 'playlist' })"
        >
          Playlists
        </button>
        <button
          class="result-control-bar__axis-btn result-control-bar__axis-track"
          :class="{ 'result-control-bar__axis-btn--active': controls.axis === 'track' }"
          @click="emit('update', { axis: 'track' })"
        >
          Tracks
        </button>
      </div>
    </template>
  </ControlBar>
</template>

<style scoped>
.result-control-bar__field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.result-control-bar__threshold {
  width: 120px;
  accent-color: var(--color-accent);
}

.result-control-bar__value {
  min-width: 4ch;
  color: var(--color-text-muted);
}

.result-control-bar__equivalence {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  color: var(--color-text-muted);
}

.result-control-bar__equivalence-input {
  accent-color: var(--color-accent);
  cursor: pointer;
}

.result-control-bar__view,
.result-control-bar__axis {
  display: flex;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.result-control-bar__view-btn,
.result-control-bar__axis-btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default);
}

.result-control-bar__view-btn + .result-control-bar__view-btn,
.result-control-bar__axis-btn + .result-control-bar__axis-btn {
  border-left: 1px solid var(--color-border-subtle);
}

.result-control-bar__view-btn--active,
.result-control-bar__axis-btn--active {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}
</style>
