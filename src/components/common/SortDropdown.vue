<script setup lang="ts">
defineProps<{
  modelValue: string
  options: Array<{ key: string; label: string }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <select
    class="sort-dropdown"
    :value="modelValue"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="opt in options" :key="opt.key" :value="opt.key">
      {{ opt.label }}
    </option>
  </select>
</template>

<style scoped>
.sort-dropdown {
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.sort-dropdown:focus {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
