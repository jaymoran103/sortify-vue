import { readonly, ref } from 'vue'
import type { MenuEntry } from '@/types/ui'

const isOpen = ref(false)
const position = ref({ x: 0, y: 0 })
const entries = ref<MenuEntry[]>([])

// Clamps the given position to ensure the context menu fits within the viewport
function clampToViewport(pos: { x: number; y: number }, menuW = 200, menuH = 300) {
  const maxX = Math.max(0, window.innerWidth - menuW)
  const maxY = Math.max(0, window.innerHeight - menuH)
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  }
}

// Main composable function to manage context menu state and behavior
export function useContextMenu() {

  // Shows context menu at the event position with the given menu entries
  function show(event: MouseEvent, items: MenuEntry[]): void {
    event.preventDefault()
    entries.value = items
    position.value = clampToViewport({ x: event.clientX, y: event.clientY })
    isOpen.value = true
  }

  // Closes the context menu and clears entries
  function close(): void {
    isOpen.value = false
    entries.value = []
  }
  
  return {
    isOpen: readonly(isOpen),
    position: readonly(position),
    entries: readonly(entries),
    show,
    close,
  }
}

export { clampToViewport }
