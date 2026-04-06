<script setup lang="ts">
import ProgressBar from './ProgressBar.vue'

defineProps<{
  isLoading: boolean
  error: Error | null
  label?: string
  progress?: number
}>()
</script>

<template>
  <div v-if="isLoading || error" class="status-indicator">
    <template v-if="isLoading">
      <span class="status-indicator__spinner" aria-hidden="true" />
      <span v-if="label" class="status-indicator__label">{{ label }}</span>
      <ProgressBar
        v-if="progress !== undefined"
        :progress="progress"
        class="status-indicator__progress"
      />
    </template>
    <template v-else-if="error">
      <span class="status-indicator__error">{{ error.message }}</span>
    </template>
  </div>
</template>

<style scoped>
.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.status-indicator__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-subtle);
  border-top-color: var(--color-accent);
  border-radius: var(--radius-full);
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-indicator__label {
  color: var(--color-text-muted);
}

.status-indicator__progress {
  flex: 1;
}

.status-indicator__error {
  color: var(--color-danger);
}
</style>
