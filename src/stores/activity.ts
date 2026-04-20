import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Ref, ComputedRef } from 'vue'
import type { ActivityItem, ActivityError, OperationProgress } from '@/types/ui'

// Delay in ms before a 'done' operation is automatically removed from the map.
const DONE_CLEAR_DELAY_MS = 5000

// When the completed operation has errors, keep it visible longer so the user can see the issue count.
const DONE_WITH_ERRORS_CLEAR_DELAY_MS = 60_000

export const useActivityStore = defineStore('activity', () => {
  const operations: Ref<Map<string, ActivityItem>> = ref(new Map())

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

  // Creates a new ActivityItem with status 'active' and null progress.
  // If an operation with the same id already exists, it is replaced.
  function startOperation(id: string, label: string): void {
    const item: ActivityItem = {
      id,
      label,
      status: 'active',
      progress: null,
      errors: [],
      startedAt: Date.now(),
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

  // Marks the operation as 'done' and records completedAt.
  // Schedules auto-removal after DONE_CLEAR_DELAY_MS (longer if there are errors).
  function completeOperation(id: string): void {
    const op = operations.value.get(id)
    if (!op) return
    const updated: ActivityItem = { ...op, status: 'done', completedAt: Date.now() }
    operations.value = new Map(operations.value).set(id, updated)
    const delay = updated.errors.length > 0 ? DONE_WITH_ERRORS_CLEAR_DELAY_MS : DONE_CLEAR_DELAY_MS
    setTimeout(() => clearOperation(id), delay)
  }

  // Marks the operation as 'error' with a top-level message appended to errors.
  function failOperation(id: string, message: string): void {
    const op = operations.value.get(id)
    if (!op) return
    const failError: ActivityError = { category: 'error', message, items: [] }
    const updated: ActivityItem = {
      ...op,
      status: 'error',
      completedAt: Date.now(),
      errors: [...op.errors, failError],
    }
    operations.value = new Map(operations.value).set(id, updated)
  }

  // Removes a single operation from the map.
  function clearOperation(id: string): void {
    const next = new Map(operations.value)
    next.delete(id)
    operations.value = next
  }

  // Removes all operations.
  function clearAll(): void {
    operations.value = new Map()
  }

  return {
    operations,
    activeOperation,
    startOperation,
    updateProgress,
    addError,
    completeOperation,
    failOperation,
    clearOperation,
    clearAll,
  }
})
