<script setup lang="ts">
import MenuDropdown from '@/components/common/MenuDropdown.vue'
import type { TrackColumn, TrackColumnKey } from './trackColumns'

// A checkbox per optional track column, in a MenuDropdown. The menu stays open while the
// user ticks several. The parent owns which are shown.
defineProps<{
  columns: readonly TrackColumn[]
  shown: ReadonlySet<TrackColumnKey>
}>()

const emit = defineEmits<{
  toggle: [key: TrackColumnKey]
}>()
</script>

<template>
  <MenuDropdown class="column-picker" label="Columns">
    <label v-for="col in columns" :key="col.key" class="column-picker__option menu-item">
      <input type="checkbox" :checked="shown.has(col.key)" @change="emit('toggle', col.key)" />
      {{ col.label }}
    </label>
  </MenuDropdown>
</template>

<style scoped>
.column-picker__option {
  white-space: nowrap;
}
</style>
