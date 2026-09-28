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
  <!-- The trigger reuses the sort dropdown's look, and the panel reuses the context menu's,
       so the control bar reads as one set. -->
  <details ref="root" class="column-picker dropdown-wrapper">
    <summary class="dropdown">Columns</summary>
    <div class="column-picker__menu menu-panel" role="group" aria-label="Track columns">
      <label v-for="col in columns" :key="col.key" class="column-picker__option menu-item">
        <input type="checkbox" :checked="shown.has(col.key)" @change="emit('toggle', col.key)" />
        {{ col.label }}
      </label>
    </div>
  </details>
</template>

<style scoped>
/* Looks come from .dropdown-wrapper, .dropdown, .menu-panel and .menu-item in
   utilities.css. Only the details-specific parts and placement live here. */
.column-picker summary {
  display: block;
  list-style: none;
}

.column-picker summary::-webkit-details-marker {
  display: none;
}

.column-picker__menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
}

.column-picker__option {
  white-space: nowrap;
}
</style>
