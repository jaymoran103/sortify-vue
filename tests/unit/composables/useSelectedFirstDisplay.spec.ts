import { ref, nextTick } from 'vue'
import { describe, it, expect } from 'vitest'
import { useSelectedFirstDisplay } from '@/composables/useSelectedFirstDisplay'

type Item = { id: string }
const keyFn = (item: Item) => item.id

const makeItems = () => ref<Item[]>([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }])

// The composables that own selection replace the Set rather than mutating it, which is what
// makes the selectedIds watcher fire. Tests must do the same.
const select = (ids: ReturnType<typeof ref<Set<string>>>, ...keys: string[]) => {
  ids.value = new Set(keys)
}

describe('useSelectedFirstDisplay', () => {
  it('populates immediately, before anything changes', () => {
    const items = makeItems()
    const selectedIds = ref(new Set<string>())
    const { displayItems } = useSelectedFirstDisplay(items, selectedIds, keyFn)
    expect(displayItems.value.map(keyFn)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('hoists selected items and keeps incoming order within each group', async () => {
    const items = makeItems()
    const selectedIds = ref(new Set(['b', 'd']))
    const { displayItems } = useSelectedFirstDisplay(items, selectedIds, keyFn)

    items.value = [...items.value]
    await nextTick()
    expect(displayItems.value.map(keyFn)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('does not reorder on selection change by default', async () => {
    const items = makeItems()
    const selectedIds = ref(new Set<string>())
    const { displayItems } = useSelectedFirstDisplay(items, selectedIds, keyFn)

    select(selectedIds, 'd')
    await nextTick()
    expect(displayItems.value.map(keyFn)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('picks the new selection up on the next items change', async () => {
    const items = makeItems()
    const selectedIds = ref(new Set<string>())
    const { displayItems } = useSelectedFirstDisplay(items, selectedIds, keyFn)

    select(selectedIds, 'd')
    await nextTick()
    items.value = [...items.value]
    await nextTick()
    expect(displayItems.value.map(keyFn)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('never mutates the source list', async () => {
    const items = makeItems()
    const selectedIds = ref(new Set(['c']))
    useSelectedFirstDisplay(items, selectedIds, keyFn)

    items.value = [...items.value]
    await nextTick()
    expect(items.value.map(keyFn)).toEqual(['a', 'b', 'c', 'd'])
  })
})
