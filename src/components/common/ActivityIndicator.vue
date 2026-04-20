<script setup lang="ts">
import { computed } from 'vue'
import { useActivityStore } from '@/stores/activity'
import { useModal } from '@/composables/useModal'
import ProgressBar from '@/components/common/ProgressBar.vue'
import IssueDetailModal from '@/components/modals/IssueDetailModal.vue'

const activityStore = useActivityStore()
const modal = useModal()
const op = computed(() => activityStore.activeOperation)

// Build display text from progress fields, truncating itemLabel with ellipsis if needed.
// Format: "{phase} '{truncated-itemLabel}' ({done}/{total})"
// Numeric suffix is never truncated; only the label gets ellipsis.
const MAX_LABEL_CHARS = 30

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s
}

// Display text computes a user-friendly status message based on the current operation's progress. It handles various cases:
// TODO separate as {itemText, doneInt, total} or {itemText, donePercent} or 
// FUTURE: Extract as utility function, maybe separate as {statusText, percentDone} or 
const statusText = computed((): string => {
  if (!op.value) return ''
  const { label, progress, status } = op.value
  if (status === 'done') return 'Complete'
  if (status === 'error') {
    const count = op.value.errors.length
    const firstMessage = op.value.errors[0]?.message
    return firstMessage
      ? `Error${count > 1 ? ` (${count})` : ''}: ${firstMessage}`
      : `Error${count > 1 ? ` (${count} errors)` : ''}`
  }

  // If no progress info available, just return the operation label
  if (!progress) return label

  // Build status text from available progress fields, truncating itemLabel if necessary
  const parts: string[] = []
  if (progress.phase) parts.push(progress.phase)
  if (progress.itemLabel) parts.push(`'${truncate(progress.itemLabel, MAX_LABEL_CHARS)}'`)
  if (progress.total > 0) parts.push(`(${progress.done}/${progress.total})`)
  return parts.length ? parts.join(' ') : label
})

// Progress value passed to ProgressBar: -1 for indeterminate, 0..1 for determinate.
const progressValue = computed((): number => {
  const p = op.value?.progress
  if (!p || p.total <= 0) return -1
  return p.done / p.total
})

const isDone = computed(() => op.value?.status === 'done')
const isError = computed(() => op.value?.status === 'error')

// Non-fatal, per-item warnings forwarded from adapter result.errors
const issueErrors = computed(() =>
  (op.value?.errors ?? []).filter((e) => e.category === 'warning'),
)

// Opens a modal listing non-fatal issues if there are any. 
// Issues are forwarded from adapters via the activity store and categorized as 'warning' so they don't show as top-level errors but are still accessible to the user.
function openIssues(): void {
  if (!op.value || issueErrors.value.length === 0) return
  modal.open(IssueDetailModal, {
    title: `Issues — ${op.value.label}`,
    messages: issueErrors.value.map((e) => e.message),
  })
}
</script>

<template>
  <div v-if="op" class="activity-indicator" :class="{ 'activity-indicator--done': isDone, 'activity-indicator--error': isError }">
    <ProgressBar :progress="isDone || isError ? (isDone ? 1 : 0) : progressValue" />
    <span class="activity-indicator__text text-sm text-muted">{{ statusText }}</span>
    <button
      v-if="issueErrors.length > 0"
      class="activity-indicator__issues-btn text-sm"
      @click="openIssues"
    >
      {{ issueErrors.length }} issue{{ issueErrors.length !== 1 ? 's' : '' }} — click to view
    </button>
  </div>
</template>

<style scoped>
.activity-indicator {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-2);
}

.activity-indicator--done .activity-indicator__text {
  color: var(--color-success, var(--color-text-muted));
}

.activity-indicator--error .activity-indicator__text {
  color: var(--color-danger, var(--color-error, var(--color-text-muted)));
}

.activity-indicator__issues-btn {
  all: unset;
  cursor: pointer;
  color: var(--color-warning, var(--color-text-muted));
  text-decoration: underline;
  align-self: flex-start;
  /* line-height: 1.4; */
}

.activity-indicator__issues-btn:hover {
  color: var(--color-text);
}
</style>
