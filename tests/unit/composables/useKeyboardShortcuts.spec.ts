import { describe, it, expect, vi, afterEach } from 'vitest'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

function fireKey(
  key: string,
  opts: Partial<KeyboardEventInit> = {},
): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, ...opts })
  document.dispatchEvent(e)
  return e
}

afterEach(() => {
  // Remove all keydown listeners added during tests by replacing the node
  // (not possible directly, so we rely on each test creating fresh composable)
})

describe('useKeyboardShortcuts', () => {
  it('calls handler when matching key combo is pressed', () => {
    const handler = vi.fn()
    useKeyboardShortcuts({ escape: handler })
    fireKey('Escape')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call handler for non-matching combos', () => {
    const handler = vi.fn()
    useKeyboardShortcuts({ escape: handler })
    fireKey('Enter')
    expect(handler).not.toHaveBeenCalled()
  })

  it('handles shift modifier', () => {
    const handler = vi.fn()
    useKeyboardShortcuts({ 'shift+delete': handler })
    fireKey('Delete', { shiftKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not fire shift shortcut without shift held', () => {
    const handler = vi.fn()
    useKeyboardShortcuts({ 'shift+delete': handler })
    fireKey('Delete', { shiftKey: false })
    expect(handler).not.toHaveBeenCalled()
  })

  it('handles plain keys (escape, enter)', () => {
    const escHandler = vi.fn()
    const enterHandler = vi.fn()
    useKeyboardShortcuts({ escape: escHandler, enter: enterHandler })
    fireKey('Escape')
    fireKey('Enter')
    expect(escHandler).toHaveBeenCalledOnce()
    expect(enterHandler).toHaveBeenCalledOnce()
  })

  it('prevents default for cmd combos', () => {
    const handler = vi.fn()
    useKeyboardShortcuts({ 'cmd+s': handler })
    // Simulate cmd on mac (metaKey) or ctrl
    const e = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true })
    const spy = vi.spyOn(e, 'preventDefault')
    document.dispatchEvent(e)
    expect(spy).toHaveBeenCalled()
  })
})
