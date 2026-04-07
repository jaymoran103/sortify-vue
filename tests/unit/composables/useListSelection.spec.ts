import { ref, nextTick } from 'vue'
import { describe, it, expect } from 'vitest'
import { useListSelection } from '@/composables/useListSelection'

type Item = { id: string; name: string }
const keyFn = (item: Item) => item.id

const makeItems = () =>
  ref<Item[]>([
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Charlie' },
    { id: 'd', name: 'Delta' },
  ])

describe('useListSelection', () => {
  it('starts with empty selection', () => {
    const items = makeItems()
    const { selectedIds, selectedCount } = useListSelection(items, keyFn)
    expect(selectedIds.value.size).toBe(0)
    expect(selectedCount.value).toBe(0)
  })

  it('toggle without modifier selects single item, clears others', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn)
    toggle('a')
    toggle('b')
    expect(selectedIds.value.has('b')).toBe(true)
    expect(selectedIds.value.has('a')).toBe(false)
    expect(selectedIds.value.size).toBe(1)
  })

  it('toggle with metaKey adds to selection', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn)
    toggle('a')
    toggle('b', { metaKey: true, ctrlKey: false, shiftKey: false } as MouseEvent)
    expect(selectedIds.value.has('a')).toBe(true)
    expect(selectedIds.value.has('b')).toBe(true)
  })

  it('toggle with metaKey on selected item deselects it', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn)
    toggle('a')
    toggle('a', { metaKey: true, ctrlKey: false, shiftKey: false } as MouseEvent)
    expect(selectedIds.value.has('a')).toBe(false)
  })

  it('toggle with ctrlKey acts as metaKey', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn)
    toggle('a')
    toggle('c', { metaKey: false, ctrlKey: true, shiftKey: false } as MouseEvent)
    expect(selectedIds.value.has('a')).toBe(true)
    expect(selectedIds.value.has('c')).toBe(true)
  })

  it('toggle with shiftKey selects range', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn)
    toggle('a') // index 0
    toggle('c', { metaKey: false, ctrlKey: false, shiftKey: true } as MouseEvent) // index 2
    expect(selectedIds.value.has('a')).toBe(true)
    expect(selectedIds.value.has('b')).toBe(true)
    expect(selectedIds.value.has('c')).toBe(true)
    expect(selectedIds.value.has('d')).toBe(false)
  })

  it('shift-select with no prior selection selects from index 0', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn)
    // lastSelectedIndex starts at -1, so range select should fall through to single select
    toggle('b', { metaKey: false, ctrlKey: false, shiftKey: true } as MouseEvent)
    // No last index, behaves like single select
    expect(selectedIds.value.has('b')).toBe(true)
    expect(selectedIds.value.size).toBe(1)
  })

  it('selectAll selects all current items', () => {
    const items = makeItems()
    const { selectAll, selectedIds } = useListSelection(items, keyFn)
    selectAll()
    expect(selectedIds.value.size).toBe(4)
  })

  it('clear empties selection', () => {
    const items = makeItems()
    const { selectAll, clear, selectedIds } = useListSelection(items, keyFn)
    selectAll()
    clear()
    expect(selectedIds.value.size).toBe(0)
  })

  it('isSelected returns correct boolean', () => {
    const items = makeItems()
    const { toggle, isSelected } = useListSelection(items, keyFn)
    toggle('a')
    expect(isSelected('a')).toBe(true)
    expect(isSelected('b')).toBe(false)
  })

  it('selectedCount reflects set size', () => {
    const items = makeItems()
    const { toggle, selectedCount } = useListSelection(items, keyFn)
    toggle('a')
    toggle('b', { metaKey: true, ctrlKey: false, shiftKey: false } as MouseEvent)
    expect(selectedCount.value).toBe(2)
  })

  it('prunes ghost selections when items change', async () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn)
    toggle('a')
    toggle('b', { metaKey: true, ctrlKey: false, shiftKey: false } as MouseEvent)
    // Remove 'a' from items
    items.value = items.value.filter((i) => i.id !== 'a')
    await nextTick()
    expect(selectedIds.value.has('a')).toBe(false)
    expect(selectedIds.value.has('b')).toBe(true)
  })
})

describe('useListSelection — selectMultiple option', () => {
  it('plain click toggles without clearing others', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn, { selectMultiple: true })
    toggle('a')
    toggle('b')
    expect(selectedIds.value.has('a')).toBe(true)
    expect(selectedIds.value.has('b')).toBe(true)
    expect(selectedIds.value.size).toBe(2)
  })

  it('plain click on selected item deselects it', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn, { selectMultiple: true })
    toggle('a')
    toggle('a')
    expect(selectedIds.value.has('a')).toBe(false)
    expect(selectedIds.value.size).toBe(0)
  })

  it('shift-range select still works with selectMultiple', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn, { selectMultiple: true })
    toggle('a')
    toggle('c', { metaKey: false, ctrlKey: false, shiftKey: true } as MouseEvent)
    expect(selectedIds.value.has('a')).toBe(true)
    expect(selectedIds.value.has('b')).toBe(true)
    expect(selectedIds.value.has('c')).toBe(true)
    expect(selectedIds.value.has('d')).toBe(false)
  })

  it('default (no option) still clears on plain click', () => {
    const items = makeItems()
    const { toggle, selectedIds } = useListSelection(items, keyFn)
    toggle('a')
    toggle('b')
    expect(selectedIds.value.has('a')).toBe(false)
    expect(selectedIds.value.size).toBe(1)
  })
})
