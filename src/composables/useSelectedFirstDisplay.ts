import { shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'

export interface SelectedFirstDisplayOptions {
  reorderOnSelectionChange?: boolean
}

// Derives a display list that keeps selected items ahead of unselected items
// while preserving the incoming sort order within each group.
export function useSelectedFirstDisplay<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  selectedIds: Ref<Set<string>>,
  keyFn: (item: T) => string,
  options: SelectedFirstDisplayOptions = {},
): {
  displayItems: ShallowRef<T[]>
} {
  const displayItems = shallowRef<T[]>([])

  function updateDisplay(nextItems: T[], ids: Set<string>): void {
    displayItems.value = [...nextItems].sort((left, right) => {
      return (ids.has(keyFn(left)) ? 0 : 1) - (ids.has(keyFn(right)) ? 0 : 1)
    })
  }

  // If reorderOnSelectionChange is true, watch both the items and selectedIds for changes and update the display order accordingly.
  if (options.reorderOnSelectionChange) {
    watch(
      [items, selectedIds],
      ([nextItems, ids]) => {
        updateDisplay(nextItems, ids)
      },
      { immediate: true },
    )
  } 
  // Otherwise, only update the display order when the items list changes, and ignore selection changes after the initial render.
  else {
    watch(
      items,
      (nextItems) => {
        updateDisplay(nextItems, selectedIds.value)
      },
      { immediate: true },
    )
  }

  return { displayItems }
}