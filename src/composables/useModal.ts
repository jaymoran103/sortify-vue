import type { Component } from 'vue'
import { useUiStore } from '@/stores/ui'

// Composable for opening/closing modals from any component without needing to import the store directly

export function useModal() {
  
  const uiStore = useUiStore()

  async function open<T = unknown>(
    component: Component,
    props?: Record<string, unknown>,
  ): Promise<T | null> {
    const result = await uiStore.openModal({ component, props })
    return (result as T | null) ?? null
  }

  function close(result?: unknown): void {
    uiStore.closeModal(result)
  }

  return { open, close }
}
