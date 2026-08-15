<script setup lang="ts">
import { computed } from 'vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import type { IndexStatus } from '@/stores/similarity'

const props = defineProps<{
  scopeLabel: string
  isEmpty: boolean
  indexStatus: IndexStatus
  uniqueTrackCount: number | null
  progress: { done: number; total: number } | null
}>()

defineEmits<{ rebuild: []; clear: [] }>()

const indexLabel = computed(() => {
  switch (props.indexStatus) {
    case 'building':
      return 'Building library index...'
    case 'ready':
      return `Library index: ${props.uniqueTrackCount ?? 0} unique tracks`
    case 'stale':
      return 'Library index is stale - the library changed since the last scan'
    case 'error':
      return 'Library index failed to build'
    default:
      return 'Library index not built'
  }
})

// ProgressBar takes a single 0..1 fraction, where a negative value renders indeterminate.
// An index build reports no counts, so it shows as indeterminate until a scan starts reporting.
const fractionDone = computed(() => {
  if (!props.progress || props.progress.total === 0) return -1
  return props.progress.done / props.progress.total
})
</script>

<template>
  <div class="cursor-bar">
    <div class="cursor-bar__scope">
      <span class="cursor-bar__scope-label">{{ scopeLabel }}</span>
      <button
        v-if="!isEmpty"
        class="cursor-bar__clear btn btn--ghost btn--sm"
        @click="$emit('clear')"
      >
        Clear
      </button>
    </div>

    <div class="cursor-bar__index">
      <span class="text-muted text-sm">{{ indexLabel }}</span>
      <button
        v-if="indexStatus === 'stale'"
        class="cursor-bar__rebuild btn btn--secondary btn--sm"
        @click="$emit('rebuild')"
      >
        Rebuild
      </button>
    </div>

    <ProgressBar
      v-if="indexStatus === 'building' || progress"
      class="cursor-bar__progress"
      :progress="fractionDone"
    />
  </div>
</template>

<style scoped>
.cursor-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
}

.cursor-bar__scope {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cursor-bar__scope-label {
  font-weight: var(--font-weight-semibold);
}

.cursor-bar__index {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.cursor-bar__progress {
  flex-basis: 100%;
}
</style>
