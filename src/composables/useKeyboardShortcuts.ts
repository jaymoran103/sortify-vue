import { onBeforeUnmount, getCurrentInstance } from 'vue'

type ShortcutMap = Record<string, (e: KeyboardEvent) => void>

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
}

function parseCombo(combo: string): {
  key: string
  meta: boolean
  shift: boolean
  alt: boolean
} {
  const parts = combo.toLowerCase().split('+')
  const key = parts[parts.length - 1] ?? ''
  return {
    key,
    meta: parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  }
}

function matchesCombo(
  e: KeyboardEvent,
  parsed: ReturnType<typeof parseCombo>,
): boolean {
  const cmdPressed = isMac() ? e.metaKey : e.ctrlKey
  if (parsed.meta !== cmdPressed) return false
  if (parsed.shift !== e.shiftKey) return false
  if (parsed.alt !== e.altKey) return false
  return e.key.toLowerCase() === parsed.key
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  const parsed = Object.entries(shortcuts).map(([combo, handler]) => ({
    combo,
    parsed: parseCombo(combo),
    handler,
    hasMeta: combo.toLowerCase().includes('cmd'),
  }))

  function onKeydown(e: KeyboardEvent): void {
    for (const entry of parsed) {
      if (matchesCombo(e, entry.parsed)) {
        if (entry.hasMeta) e.preventDefault()
        entry.handler(e)
        return
      }
    }
  }

  document.addEventListener('keydown', onKeydown)

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      document.removeEventListener('keydown', onKeydown)
    })
  }
}
