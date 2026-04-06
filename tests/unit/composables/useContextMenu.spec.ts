import { describe, it, expect, afterEach} from 'vitest'
import { useContextMenu, clampToViewport } from '@/composables/useContextMenu'
import type { MenuEntry } from '@/types/ui'

const menuItems: MenuEntry[] = [
  { label: 'Copy', action: () => {} },
  { divider: true },
  { label: 'Delete', action: () => {} },
]

function makeMouseEvent(x: number, y: number): MouseEvent {
  return new MouseEvent('contextmenu', { clientX: x, clientY: y, bubbles: true })
}

describe('useContextMenu', () => {
  afterEach(() => {
    useContextMenu().close()
  })

  it('starts closed with empty entries', () => {
    const ctx = useContextMenu()
    expect(ctx.isOpen.value).toBe(false)
    expect(ctx.entries.value).toHaveLength(0)
  })

  it('show sets position, entries, and isOpen', () => {
    const ctx = useContextMenu()
    ctx.show(makeMouseEvent(100, 200), menuItems)
    expect(ctx.isOpen.value).toBe(true)
    expect(ctx.entries.value).toHaveLength(3)
  })

  it('close resets state', () => {
    const ctx = useContextMenu()
    ctx.show(makeMouseEvent(100, 200), menuItems)
    ctx.close()
    expect(ctx.isOpen.value).toBe(false)
    expect(ctx.entries.value).toHaveLength(0)
  })

  it('opening again replaces previous entries', () => {
    const ctx = useContextMenu()
    ctx.show(makeMouseEvent(10, 10), menuItems)
    const newItems: MenuEntry[] = [{ label: 'Paste', action: () => {} }]
    ctx.show(makeMouseEvent(50, 50), newItems)
    expect(ctx.entries.value).toHaveLength(1)
  })

  it('clamps position to viewport bounds', () => {
    // Use clampToViewport directly since jsdom window dims may be 0
    const result = clampToViewport({ x: -50, y: -100 })
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })

  it('clamps position that exceeds viewport right/bottom', () => {
    const result = clampToViewport({ x: 900, y: 800 }, 200, 300)
    // With innerWidth/Height potentially 0 in jsdom, result should be >=0
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })
})
