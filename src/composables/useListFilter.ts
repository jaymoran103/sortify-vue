import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useDebounce } from './useDebounce'
import type { FilterFn } from '@/types/ui'

export function useListFilter<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  filterFn: FilterFn<T>,
  debounceMs = 200,
): {
  query: Ref<string>
  filtered: ComputedRef<T[]>
} {
  const query = ref('')
  const debouncedQuery = useDebounce(query, debounceMs)

  const filtered = computed(() => {
    const q = debouncedQuery.value.trim()
    if (!q) return items.value
    return items.value.filter((item) => filterFn(item, q))
  })

  return { query, filtered }
}
