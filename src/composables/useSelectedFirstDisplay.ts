import { shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'

/**
 * Derives a display list that keeps selected items ahead of unselected items while preserving
 * the incoming sort order within each group.
 *
 * Regrouping happens when `items` changes — a new sort, a new filter, the source updating — and
 * never on a selection toggle. Hoisting a row the moment it is ticked moves the next row the
 * user meant to click out from under the cursor, which is worst in exactly the multi-select
 * lists this serves. Deferring to a change the user initiated keeps the list still while they
 * work and regroups where they already expect movement.
 */
export function useSelectedFirstDisplay<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  selectedIds: Ref<Set<string>>,
  keyFn: (item: T) => string,
): {
  displayItems: ShallowRef<T[]>
} {
  const displayItems = shallowRef<T[]>([])

  watch(
    items,
    (nextItems) => {
      const ids = selectedIds.value
      displayItems.value = [...nextItems].sort((left, right) => {
        return (ids.has(keyFn(left)) ? 0 : 1) - (ids.has(keyFn(right)) ? 0 : 1)
      })
    },
    { immediate: true },
  )

  return { displayItems }
}
