import { ref, computed, toValue, type Ref, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import type { SortOption } from '@/types/ui'

/**
 * Sorts a reactive list by a user-selectable option.
 *
 * Inputs:
 *   items       - source list, re-sorted whenever it or the active option changes.
 *   options     - sort options. Accepts a plain array, a ref, or a getter, so callers can add
 *                 or remove options at runtime and have `sorted` see the change. The workspace's
 *                 dynamic "sort by this playlist" entry is the motivating case.
 *   defaultSort - key to start on. Falls back to the first option's key, then to ''.
 *
 * Outputs: `currentSort` (writable active key) and `sorted` (derived list).
 *
 * No side effects — purely derived state. The source list is never mutated; `sorted` sorts a copy.
 */
export function useListSort<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  options: MaybeRefOrGetter<SortOption<T>[]>,
  defaultSort?: string,
): {
  currentSort: Ref<string>
  sorted: ComputedRef<T[]>
} {
  const initialKey = defaultSort ?? toValue(options)[0]?.key ?? ''
  const currentSort = ref(initialKey)

  const sorted = computed(() => {
    // Unwrap on every evaluation, not once in the closure — otherwise a reactive options
    // list would be captured at setup time and later additions would never be seen.
    const opts = toValue(options)

    // Unknown key falls back to the first available option rather than returning the list
    // unsorted. A dangling key happens whenever a dynamic option is removed while active,
    // and silently skipping the sort made that failure invisible.
    const option = opts.find((o) => o.key === currentSort.value) ?? opts[0]
    if (!option) return items.value
    return [...items.value].sort(option.compareFn)
  })

  return { currentSort, sorted }
}
