<script setup lang="ts">
defineProps<{
  label: string
  subtitle?: string
  selected: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <div
    class="selectable-item"
    :class="{ 'selectable-item--selected': selected }"
    @click="emit('toggle')"
  >
    <input
      type="checkbox"
      class="selectable-item__checkbox"
      :checked="selected"
      tabindex="-1"
      @click.stop
      @change="emit('toggle')"
    />
    <div class="selectable-item__content">
      <span class="selectable-item__label">{{ label }}</span>
      <span v-if="subtitle" class="selectable-item__subtitle">{{ subtitle }}</span>
    </div>
  </div>
</template>

<style scoped>
.selectable-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) var(--ease-default);
}

.selectable-item:hover {
  background: var(--color-row-hover);
}

.selectable-item--selected {
  background: var(--color-accent-subtle);
}

.selectable-item--selected:hover {
  background: var(--color-accent-subtle);
}

.selectable-item__checkbox {
  flex-shrink: 0;
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.selectable-item__content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.selectable-item__label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selectable-item__subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
