<script setup lang="ts">
import { computed } from 'vue'
import ControlBar from '@/components/common/ControlBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import type { OverlapControls, ResultMeasure } from '@/similarity/types'

const props = defineProps<{ controls: OverlapControls; measures: ResultMeasure[] }>()
const emit = defineEmits<{ update: [patch: Partial<OverlapControls>] }>()

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
    <label class="result-control-bar__field">
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

    <template #actions>
      <div class="result-control-bar__axis">
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

.result-control-bar__axis {
  display: flex;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.result-control-bar__axis-btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default);
}

.result-control-bar__axis-btn + .result-control-bar__axis-btn {
  border-left: 1px solid var(--color-border-subtle);
}

.result-control-bar__axis-btn--active {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}
</style>
