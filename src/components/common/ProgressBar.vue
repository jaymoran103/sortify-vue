<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  progress: number
  label?: string
}>()

const isIndeterminate = computed(() => props.progress < 0)
const fillWidth = computed(() =>
  isIndeterminate.value ? '100%' : `${Math.round(Math.min(1, Math.max(0, props.progress)) * 100)}%`,
)
</script>

<template>
  <div class="progress-bar">
    <span v-if="label" class="progress-bar__label">{{ label }}</span>
    <div class="progress-bar__track">
      <div
        class="progress-bar__fill"
        :class="{ 'progress-bar__fill--indeterminate': isIndeterminate }"
        :style="isIndeterminate ? {} : { width: fillWidth }"
        role="progressbar"
        :aria-valuenow="isIndeterminate ? undefined : Math.round(progress * 100)"
        :aria-valuemin="0"
        :aria-valuemax="100"
      />
    </div>
  </div>
</template>

<style scoped>
.progress-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.progress-bar__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.progress-bar__track {
  height: 4px;
  background: var(--color-surface-raised);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) var(--ease-out);
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

.progress-bar__fill--indeterminate {
  width: 40%;
  animation: shimmer 1.2s var(--ease-out) infinite;
}
</style>
