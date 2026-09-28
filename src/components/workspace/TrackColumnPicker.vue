<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { TrackColumn, TrackColumnKey } from './trackColumns'

// A dropdown of checkboxes, one per optional track column. It stays open while the user
// ticks several, and closes on a click outside or Escape. The parent owns which are shown.
defineProps<{
  columns: readonly TrackColumn[]
  shown: ReadonlySet<TrackColumnKey>
}>()

const emit = defineEmits<{
  toggle: [key: TrackColumnKey]
}>()

const root = ref<HTMLDetailsElement | null>(null)

function closeOnOutside(event: MouseEvent): void {
  if (root.value?.open && !root.value.contains(event.target as Node)) root.value.open = false
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape' && root.value?.open) root.value.open = false
}

onMounted(() => {
  document.addEventListener('click', closeOnOutside)
  document.addEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutside)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <details ref="root" class="column-picker">
    <summary class="btn btn--ghost btn--sm">Columns</summary>
    <div class="column-picker__menu" role="group" aria-label="Track columns">
      <label v-for="col in columns" :key="col.key" class="column-picker__option">
        <input type="checkbox" :checked="shown.has(col.key)" @change="emit('toggle', col.key)" />
        {{ col.label }}
      </label>
    </div>
  </details>
</template>

<style scoped>
.column-picker {
  position: relative;
}

.column-picker summary {
  list-style: none;
}

.column-picker summary::-webkit-details-marker {
  display: none;
}

.column-picker__menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 140px;
  padding: var(--space-2);
  background: var(--color-surface);
  border: 2px solid var(--color-border-subtle);
}

.column-picker__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  cursor: pointer;
  white-space: nowrap;
}
</style>
