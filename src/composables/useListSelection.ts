import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

export function useListSelection<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  keyFn: (item: T) => string,
): {
  selectedIds: Ref<Set<string>>
  lastSelectedIndex: Ref<number>
  toggle: (id: string, event?: MouseEvent | KeyboardEvent) => void
  selectAll: () => void
  clear: () => void
  isSelected: (id: string) => boolean
  selectedCount: ComputedRef<number>
} {
  const selectedIds = ref<Set<string>>(new Set())
  const lastSelectedIndex = ref(-1)

  // Prune ghost selections and reset last index when items change
  watch(
    () => items.value.map(keyFn),
    (currentKeys) => {
      const keySet = new Set(currentKeys)
      const pruned = new Set<string>()
      for (const id of selectedIds.value) {
        if (keySet.has(id)) pruned.add(id)
      }
      selectedIds.value = pruned
      lastSelectedIndex.value = -1
    },
    { deep: false },
  )

  function toggle(id: string, event?: MouseEvent | KeyboardEvent): void {
    const idx = items.value.findIndex((item) => keyFn(item) === id)
    const isMeta = event ? event.metaKey || event.ctrlKey : false
    const isShift = event ? event.shiftKey : false

    if (isShift && lastSelectedIndex.value >= 0 && idx >= 0) {
      // Range select
      const start = Math.min(lastSelectedIndex.value, idx)
      const end = Math.max(lastSelectedIndex.value, idx)
      const rangeIds = new Set<string>()
      for (let i = start; i <= end; i++) {
        rangeIds.add(keyFn(items.value[i]!))
      }
      selectedIds.value = rangeIds
    } else if (isMeta) {
      // Toggle without affecting others
      const next = new Set(selectedIds.value)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      selectedIds.value = next
      if (idx >= 0) lastSelectedIndex.value = idx
    } else {
      // Clear and select single
      selectedIds.value = new Set([id])
      if (idx >= 0) lastSelectedIndex.value = idx
    }
  }

  function selectAll(): void {
    selectedIds.value = new Set(items.value.map(keyFn))
  }

  function clear(): void {
    selectedIds.value = new Set()
    lastSelectedIndex.value = -1
  }

  function isSelected(id: string): boolean {
    return selectedIds.value.has(id)
  }

  const selectedCount = computed(() => selectedIds.value.size)

  return {
    selectedIds,
    lastSelectedIndex,
    toggle,
    selectAll,
    clear,
    isSelected,
    selectedCount,
  }
}
