import { ref, nextTick } from 'vue'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useListFilter } from '@/composables/useListFilter'

type Item = { name: string }
const filterFn = (item: Item, q: string) => item.name.toLowerCase().includes(q.toLowerCase())

describe('useListFilter', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns all items when query is empty', () => {
    const items = ref([{ name: 'Alpha' }, { name: 'Beta' }])
    const { filtered } = useListFilter(items, filterFn)
    expect(filtered.value).toHaveLength(2)
  })

  it('filters items using provided filterFn', async () => {
    const items = ref([{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Almond' }])
    const { query, filtered } = useListFilter(items, filterFn, 0)
    query.value = 'al'
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(filtered.value.map((i: Item) => i.name)).toEqual(['Alpha', 'Almond'])
  })

  it('filter is case-insensitive via filterFn', async () => {
    const items = ref([{ name: 'Alpha' }])
    const { query, filtered } = useListFilter(items, filterFn, 0)
    query.value = 'ALPHA'
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(filtered.value).toHaveLength(1)
  })

  it('returns all items when query is whitespace only', async () => {
    const items = ref([{ name: 'Alpha' }, { name: 'Beta' }])
    const { query, filtered } = useListFilter(items, filterFn, 0)
    query.value = '   '
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(filtered.value).toHaveLength(2)
  })

  it('updates filtered list when items change', async () => {
    const items = ref([{ name: 'Alpha' }])
    const { query, filtered } = useListFilter(items, filterFn, 0)
    query.value = 'al'
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(filtered.value).toHaveLength(1)
    items.value = [...items.value, { name: 'Alabama' }]
    await nextTick()
    expect(filtered.value).toHaveLength(2)
  })

  it('updates filtered list when query changes', async () => {
    const items = ref([{ name: 'Alpha' }, { name: 'Beta' }])
    const { query, filtered } = useListFilter(items, filterFn, 0)
    query.value = 'beta'
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(filtered.value.map((i: Item) => i.name)).toEqual(['Beta'])
  })

  it('debounces query changes', async () => {
    const items = ref([{ name: 'Alpha' }, { name: 'Beta' }])
    const { query, filtered } = useListFilter(items, filterFn, 200)
    query.value = 'beta'
    // Before debounce fires, still shows all
    await nextTick()
    expect(filtered.value).toHaveLength(2)
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(filtered.value).toHaveLength(1)
  })
})
