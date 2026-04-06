<script setup lang="ts">
defineSlots<{
  default(): unknown
  actions?(): unknown
}>()
</script>

<template>
  <div class="control-bar">
    <div class="control-bar__controls">
      <slot />
    </div>
    <div v-if="$slots.actions" class="control-bar__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.control-bar__controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.control-bar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
