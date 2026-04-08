<script setup lang="ts">
defineProps<{
  modelValue: string
  options: Array<{ key: string; label: string }>
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="dropdown-wrapper">
    <select
      class="sort-dropdown dropdown"
      :value="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="opt in options" :key="opt.key" :value="opt.key">
        {{ opt.label }}
      </option>
    </select>
    
    <!-- <span class="dropdown-icon">▾</span> -->

  </div>
</template>

