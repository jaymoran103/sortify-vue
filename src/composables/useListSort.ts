import { ref, computed, watch, toValue, type Ref, type ComputedRef, type MaybeRefOrGetter } from 'vue'
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
 * Side effect: `currentSort` is rewritten to the first available key whenever the option it
 * names leaves the list, so the key never dangles. Otherwise purely derived state — the
 * source list is never mutated; `sorted` sorts a copy.
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

  // The fallback above keeps `sorted` correct when a dynamic option is removed while active,
  // but currentSort would keep naming the departed option. A <select> bound to a key matching
  // no <option> renders blank, so the key is rewritten to match what `sorted` actually did.
  //
  // The getter returns a fresh array each run, so this fires on every options recomputation
  // and the membership check — not the watcher — is what decides whether anything changes.
  // An empty list is left alone: there is nothing to fall back to, and the caller may be
  // mid-load rather than genuinely optionless.
  watch(
    () => toValue(options).map((o) => o.key),
    (keys) => {
      const fallback = keys[0]
      if (fallback !== undefined && !keys.includes(currentSort.value)) {
        currentSort.value = fallback
      }
    },
  )

  return { currentSort, sorted }
}
