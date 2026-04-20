import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Ref, ComputedRef } from 'vue'
import type { ActivityItem, ActivityError, ActivitySummary, OperationProgress, OperationSource } from '@/types/ui'

// Delay in ms before a 'done' operation is automatically removed from the map.
const DONE_CLEAR_DELAY_MS = 5000

// When the completed operation has errors, keep it visible longer so the user can see the issue count.
const DONE_WITH_ERRORS_CLEAR_DELAY_MS = 60_000

export const useActivityStore = defineStore('activity', () => {
  
  // Live operations map — drives ActivityIndicator. Items auto-clear after completion.
  const operations: Ref<Map<string, ActivityItem>> = ref(new Map())

  // Persistent completed-operation history — drives IOSummaryCard.
  // Items survive until explicitly dismissed or cleared by the user.
  const history: Ref<ActivityItem[]> = ref([])

  // Returns the first active operation, or the most recently completed/failed operation when idle.
  const activeOperation: ComputedRef<ActivityItem | null> = computed(() => {
    let latestFinished: ActivityItem | null = null

    for (const op of operations.value.values()) {
      if (op.status === 'active') return op

      if (op.status === 'done' || op.status === 'error') {
        const opTime = op.completedAt ?? op.startedAt
        const latestTime = latestFinished?.completedAt ?? latestFinished?.startedAt ?? -1
        if (!latestFinished || opTime > latestTime) {
          latestFinished = op
        }
      }
    }

    return latestFinished
  })

  // History sorted newest-first. IOSummaryCard applies its own display limit.
  const recentOperations: ComputedRef<ActivityItem[]> = computed(() =>
    [...history.value].sort(
      (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt),
    ),
  )

  // Creates a new ActivityItem with status 'active' and null progress.
  // If an operation with the same id already exists, it is replaced.
  function startOperation(id: string, label: string, source?: OperationSource): void {
    const item: ActivityItem = {
      id,
      label,
      status: 'active',
      progress: null,
      errors: [],
      startedAt: Date.now(),
      source,
    }
    operations.value = new Map(operations.value).set(id, item)
  }

  // Sets the progress payload on the specified operation.
  function updateProgress(id: string, progress: OperationProgress): void {
    const op = operations.value.get(id)
    if (!op) return
    const updated: ActivityItem = { ...op, progress }
    operations.value = new Map(operations.value).set(id, updated)
  }

  // Appends an error to the operation's error list.
  function addError(id: string, error: ActivityError): void {
    const op = operations.value.get(id)
    if (!op) return
    const updated: ActivityItem = { ...op, errors: [...op.errors, error] }
    operations.value = new Map(operations.value).set(id, updated)
  }

  // Marks the operation as 'done', records completedAt, stores optional summary.
  // Appends to history and schedules auto-removal from operations.
  function completeOperation(id: string, summary?: ActivitySummary): void {
    const op = operations.value.get(id)
    if (!op) return
    const updated: ActivityItem = { ...op, status: 'done', completedAt: Date.now(), summary }
    operations.value = new Map(operations.value).set(id, updated)
    history.value = [...history.value, updated]
    const delay = updated.errors.length > 0 ? DONE_WITH_ERRORS_CLEAR_DELAY_MS : DONE_CLEAR_DELAY_MS
    setTimeout(() => clearOperation(id), delay)
  }

  // Marks the operation as 'error' with a top-level message appended to errors.
  // errorCategory defaults to 'error' but callers may pass 'rate-limit' or other category strings.
  // Also appends the failed item to history.
  function failOperation(id: string, message: string, errorCategory: string = 'error'): void {
    const op = operations.value.get(id)
    if (!op) return
    const failError: ActivityError = { category: errorCategory, message, items: [] }
    const updated: ActivityItem = {
      ...op,
      status: 'error',
      completedAt: Date.now(),
      errors: [...op.errors, failError],
    }
    operations.value = new Map(operations.value).set(id, updated)
    history.value = [...history.value, updated]
  }

  // Removes a single operation from the live map.
  function clearOperation(id: string): void {
    const next = new Map(operations.value)
    next.delete(id)
    operations.value = next
  }

  // Removes all live operations (does not affect history).
  function clearAll(): void {
    operations.value = new Map()
  }

  // Removes a single item from history AND from the live operations map (stops ActivityIndicator showing it).
  function dismissHistoryItem(id: string): void {
    history.value = history.value.filter((item) => item.id !== id)
    clearOperation(id)
  }

  // Removes all items from history (does not affect live operations).
  function clearHistory(): void {
    history.value = []
  }

  return {
    operations,
    history,
    activeOperation,
    recentOperations,
    startOperation,
    updateProgress,
    addError,
    completeOperation,
    failOperation,
    clearOperation,
    clearAll,
    dismissHistoryItem,
    clearHistory,
  }
})
