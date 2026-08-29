import { computed, type ComputedRef, type MaybeRefOrGetter, type Ref, type ShallowRef } from 'vue'
import { useListFilter } from './useListFilter'
import { useListSelection } from './useListSelection'
import { useListSort } from './useListSort'
import { useSelectedFirstDisplay } from './useSelectedFirstDisplay'
import type { FilterFn, SortOption } from '@/types/ui'

export interface SelectableListConfig<T> {
  /** Full candidate set. Doubles as the prune source, so filtering never deselects. */
  items: Ref<T[]> | ComputedRef<T[]>
  keyFn: (item: T) => string
  filterFn: FilterFn<T>
  sortOptions: MaybeRefOrGetter<SortOption<T>[]>
  defaultSort?: string
  debounceMs?: number
  /** Checkbox semantics by default — every selection modal wants them. */
  selectMultiple?: boolean
  /** Re-sort selected-to-top on every toggle, not just when the list changes. */
  reorderOnSelectionChange?: boolean
}

export interface SelectableList<T> {
  query: Ref<string>
  currentSort: Ref<string>
  /** Filtered and sorted. The visible set: what Select All acts on. */
  sorted: ComputedRef<T[]>
  /** `sorted`, selected items hoisted to the top. What the list renders. */
  displayItems: ShallowRef<T[]>
  selectedIds: Ref<Set<string>>
  selectedCount: ComputedRef<number>
  isSelected: (id: string) => boolean
  toggle: (id: string, event?: MouseEvent | KeyboardEvent) => void
  selectAll: () => void
  clear: () => void
  allSelected: ComputedRef<boolean>
  toggleSelectAll: () => void
}

/**
 * The filter -> sort -> select -> selected-first pipeline every selection modal builds.
 *
 * Each of the four modals wired these four composables together by hand and added its own
 * allSelected/toggleSelectAll, which is how they drifted: SpotifyPlaylistPickerModal measured
 * Select All against the unfiltered list while the others measured the visible one.
 *
 * allSelected is defined here against `sorted` — items selected but filtered out do not count
 * toward it, matching what the other three already did and documented.
 */
export function useSelectableList<T>(config: SelectableListConfig<T>): SelectableList<T> {
  const { items, keyFn, filterFn, sortOptions } = config

  const { query, filtered } = useListFilter<T>(items, filterFn, config.debounceMs)
  const { currentSort, sorted } = useListSort<T>(filtered, sortOptions, config.defaultSort)

  // `sorted` scopes Select All and ordering; `items` is the authority for pruning ghosts.
  const selection = useListSelection<T>(
    sorted,
    keyFn,
    { selectMultiple: config.selectMultiple ?? true },
    items,
  )

  const { displayItems } = useSelectedFirstDisplay(sorted, selection.selectedIds, keyFn, {
    reorderOnSelectionChange: config.reorderOnSelectionChange,
  })

  const allSelected = computed(
    () => sorted.value.length > 0 && sorted.value.every((item) => selection.isSelected(keyFn(item))),
  )

  // clear() drops selections hidden by the filter too, which is what all four call sites did.
  function toggleSelectAll(): void {
    if (allSelected.value) selection.clear()
    else selection.selectAll()
  }

  return {
    query,
    currentSort,
    sorted,
    displayItems,
    selectedIds: selection.selectedIds,
    selectedCount: selection.selectedCount,
    isSelected: selection.isSelected,
    toggle: selection.toggle,
    selectAll: selection.selectAll,
    clear: selection.clear,
    allSelected,
    toggleSelectAll,
  }
}
