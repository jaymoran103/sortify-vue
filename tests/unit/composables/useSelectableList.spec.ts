import { ref, nextTick } from 'vue'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSelectableList } from '@/composables/useSelectableList'
import type { SortOption } from '@/types/ui'

type Item = { id: string; name: string }

const keyFn = (item: Item) => item.id
const filterFn = (item: Item, q: string) => item.name.toLowerCase().includes(q.toLowerCase())
const sortOptions: SortOption<Item>[] = [
  { key: 'name', label: 'Name', compareFn: (a, b) => a.name.localeCompare(b.name) },
]

const makeItems = () =>
  ref<Item[]>([
    { id: 'c', name: 'Charlie' },
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
  ])

const makeList = (items = makeItems()) =>
  useSelectableList<Item>({ items, keyFn, filterFn, sortOptions, debounceMs: 0 })

// Query changes run through useListFilter's debounce even at 0ms.
const applyQuery = async () => {
  vi.advanceTimersByTime(0)
  await nextTick()
}

describe('useSelectableList', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('feeds filter output through sort into displayItems', async () => {
    const { query, displayItems } = makeList()
    expect(displayItems.value.map(keyFn)).toEqual(['a', 'b', 'c'])

    // Matches Alpha and Charlie, which arrive in source order c, a.
    query.value = 'ha'
    await applyQuery()
    expect(displayItems.value.map(keyFn)).toEqual(['a', 'c'])
  })

  it('keeps selections that the filter hides', async () => {
    const { query, toggle, selectedIds } = makeList()
    toggle('c')

    query.value = 'alpha'
    await applyQuery()
    expect(selectedIds.value.has('c')).toBe(true)
  })

  it('measures allSelected against the visible set, not the full one', async () => {
    const { query, toggle, allSelected } = makeList()
    toggle('a')
    expect(allSelected.value).toBe(false)

    // 'a' is now the only visible item, so every visible item is selected.
    query.value = 'alpha'
    await applyQuery()
    expect(allSelected.value).toBe(true)
  })

  it('toggleSelectAll selects every visible item, then clears', () => {
    const { toggleSelectAll, selectedCount, allSelected } = makeList()

    toggleSelectAll()
    expect(selectedCount.value).toBe(3)
    expect(allSelected.value).toBe(true)

    toggleSelectAll()
    expect(selectedCount.value).toBe(0)
  })

  it('hoists selected items above unselected ones when the list changes', async () => {
    const items = makeItems()
    const { toggle, displayItems } = makeList(items)
    toggle('c')

    items.value = [...items.value, { id: 'd', name: 'Delta' }]
    await nextTick()
    expect(displayItems.value[0]!.id).toBe('c')
  })

  it('defaults to checkbox semantics', () => {
    const { toggle, selectedIds } = makeList()
    toggle('a')
    toggle('b')
    expect(selectedIds.value.has('a')).toBe(true)
    expect(selectedIds.value.has('b')).toBe(true)
  })

})
