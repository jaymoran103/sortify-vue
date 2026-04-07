import { ref, computed, watch, shallowRef, type Ref, type ComputedRef } from 'vue'

export interface ListSelectionOptions {
  /** selectMultiple:
  Then false (default), plan click clears selection (row semantics)
  When true, plain click toggles just the clicked item (checkbox semantics) */
  selectMultiple?: boolean

  /** selectedFirst: when true, selected items sort to the top of displayItems whenever the source items list changes (sort/filter event). 
   * Selection interactions do NOT trigger re-ordering — only list content changes do, preserving focus stability during interaction. */
  selectedFirst?: boolean

  // FUTURE: could be used to conditionally show select all button in UI, but doesn't affect logic for now
  //showSelectAll?: boolean 
}

// Composable for managing list selection state and interactions (click, shift-click, ctrl/cmd-click).
export function useListSelection<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  keyFn: (item: T) => string,
  options?: ListSelectionOptions,
): {
  selectedIds: Ref<Set<string>>
  lastSelectedIndex: Ref<number>
  toggle: (id: string, event?: MouseEvent | KeyboardEvent) => void
  selectAll: () => void
  clear: () => void
  isSelected: (id: string) => boolean
  selectedCount: ComputedRef<number>
  displayItems: Ref<T[]>
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
      // Checkbox semantics: toggle without clearing others
      if (options?.selectMultiple) {
        const next = new Set(selectedIds.value)
        // Toggle the clicked item
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        // Update selection, keeping others intact
        selectedIds.value = next
        if (idx >= 0) lastSelectedIndex.value = idx
      } 
      // Row semantics: clear and select single
      else {
        //FUTURE: use common methods for consistency? With 2 lines and low complexity, this feels fine for now
        selectedIds.value = new Set([id])
        if (idx >= 0) lastSelectedIndex.value = idx
      }
    }
  }

  function selectAll(): void {
    selectedIds.value = new Set(items.value.map(keyFn))
  }
  // Clear selection, reset last index
  function clear(): void {
    selectedIds.value = new Set()
    lastSelectedIndex.value = -1
  }

  function isSelected(id: string): boolean {
    return selectedIds.value.has(id)
  }

  const selectedCount = computed(() => selectedIds.value.size)

  // displayItems mirrors items (sorted/filtered). When selectedFirst is enabled, selected items
  // are sorted to the top whenever the source list changes. Selection changes do NOT trigger
  // a re-order — only sort/filter events do, matching the intended vanilla behaviour.
  const displayItems = shallowRef<T[]>([...items.value])
  watch(
    items,
    (newItems) => {
      if (options?.selectedFirst) {
        const ids = selectedIds.value
        displayItems.value = [...newItems].sort((a, b) => {
          const aSelected = ids.has(keyFn(a)) ? 0 : 1
          const bSelected = ids.has(keyFn(b)) ? 0 : 1
          return aSelected - bSelected
        })
      } else {
        displayItems.value = [...newItems]
      }
    },
    { immediate: true },
  )

  return {
    selectedIds,
    lastSelectedIndex,
    toggle,
    selectAll,
    clear,
    isSelected,
    selectedCount,
    displayItems,
  }
}
