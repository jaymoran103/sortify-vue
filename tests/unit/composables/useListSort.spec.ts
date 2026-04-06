import { ref, nextTick } from 'vue'
import { describe, it, expect } from 'vitest'
import { useListSort } from '@/composables/useListSort'
import type { SortOption } from '@/types/ui'

type Item = { name: string; value: number }

const options: SortOption<Item>[] = [
  { key: 'name-asc', label: 'Name A–Z', compareFn: (a: Item, b: Item) => a.name.localeCompare(b.name) },
  { key: 'value-asc', label: 'Value ↑', compareFn: (a: Item, b: Item) => a.value - b.value },
  { key: 'value-desc', label: 'Value ↓', compareFn: (a: Item, b: Item) => b.value - a.value },
]

const items = ref<Item[]>([
  { name: 'Charlie', value: 3 },
  { name: 'Alpha', value: 1 },
  { name: 'Beta', value: 2 },
])

describe('useListSort', () => {
  it('defaults to first option when no defaultSort specified', () => {
    const { currentSort } = useListSort(items, options)
    expect(currentSort.value).toBe('name-asc')
  })

  it('defaults to provided defaultSort key', () => {
    const { currentSort } = useListSort(items, options, 'value-asc')
    expect(currentSort.value).toBe('value-asc')
  })

  it('sorts by the selected sort option compareFn', () => {
    const { sorted } = useListSort(items, options, 'name-asc')
    expect(sorted.value.map((i: Item) => i.name)).toEqual(['Alpha', 'Beta', 'Charlie'])
  })

  it('returns items in original order when no sort matches', () => {
    const { currentSort, sorted } = useListSort(items, options, 'name-asc')
    currentSort.value = 'nonexistent'
    expect(sorted.value).toEqual(items.value)
  })

  it('updates when currentSort changes', async () => {
    const { currentSort, sorted } = useListSort(items, options, 'name-asc')
    currentSort.value = 'value-desc'
    await nextTick()
    expect(sorted.value.map((i: Item) => i.value)).toEqual([3, 2, 1])
  })

  it('updates when source items change', async () => {
    const local = ref<Item[]>([{ name: 'B', value: 2 }, { name: 'A', value: 1 }])
    const { sorted } = useListSort(local, options, 'name-asc')
    expect(sorted.value.map((i: Item) => i.name)).toEqual(['A', 'B'])
    local.value = [{ name: 'C', value: 3 }, { name: 'A', value: 1 }, { name: 'B', value: 2 }]
    await nextTick()
    expect(sorted.value.map((i: Item) => i.name)).toEqual(['A', 'B', 'C'])
  })
})
