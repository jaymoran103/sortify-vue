import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import type { ModalConfig } from '@/types/ui'

// Store for UI state - currently just modals. Will soon expand to dropdowns, toasts, any other UI state that will need to be shared across components
export const useUiStore = defineStore('ui', () => {

  const activeModal: Ref<{
    config: ModalConfig
    resolve: (value: unknown) => void
  } | null> = ref(null)

  function openModal(config: ModalConfig): Promise<unknown> {
    if (activeModal.value) activeModal.value.resolve(null)
    return new Promise((resolve) => {
      activeModal.value = { config, resolve }
    })
  }

  function closeModal(result?: unknown): void {
    if (!activeModal.value) return
    activeModal.value.resolve(result ?? null)
    activeModal.value = null
  }

  return { activeModal, openModal, closeModal}
})
