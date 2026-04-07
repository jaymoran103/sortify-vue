import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

export interface ListSelectionOptions {
  /** selectMultiple:
  Then false (default), plan click clears selection (row semantics)
  When true, plain click toggles just the clicked item (checkbox semantics) */
  selectMultiple?: boolean

  // FUTURE: could be used to conditionally show select all button in UI, but doesn't affect logic for now
  //showSelectAll?: boolean 
}

// Composable for managing list selection state and interactions (click, shift-click, ctrl/cmd-click).
// validItems: optional authoritative source for pruning 
//  - defaults to items if omitted.
//  - Passing the full unfiltered dataset here means that filtering items out doesn't deselect them.
//  - items still governs selectAll scope and display ordering.
export function useListSelection<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  keyFn: (item: T) => string,
  options?: ListSelectionOptions,
  validItems?: Ref<T[]> | ComputedRef<T[]>,
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

  // Prune ghost selections when items are removed from the data source.
  // Uses validItems if provided (full dataset) so that filtering does not cause deselection.
  const pruneSource = validItems ?? items
  watch(
    () => pruneSource.value.map(keyFn),
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
    // Add all currently visible items to the selection without clearing filtered-out selections (union)
    const next = new Set(selectedIds.value)
    for (const item of items.value) {
      next.add(keyFn(item))
    }
    selectedIds.value = next
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
