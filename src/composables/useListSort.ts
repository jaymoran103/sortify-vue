import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { SortOption } from '@/types/ui'

export function useListSort<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  options: SortOption<T>[],
  defaultSort?: string,
): {
  currentSort: Ref<string>
  sorted: ComputedRef<T[]>
} {
  const initialKey = defaultSort ?? options[0]?.key ?? ''
  const currentSort = ref(initialKey)

  const sorted = computed(() => {
    const option = options.find((o) => o.key === currentSort.value)
    if (!option) return items.value
    return [...items.value].sort(option.compareFn)
  })

  return { currentSort, sorted }
}
