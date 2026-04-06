<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
const modalShell = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// When a modal is opened, save the currently focused element and move focus to the first focusable element in the modal. When the modal is closed, restore focus to the previously focused element.
watch(
  () => uiStore.activeModal,
  async (modal) => {
    if (modal) {
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      const first = modalShell.value?.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    } else {
      previouslyFocused?.focus()
      previouslyFocused = null
    }
  },
)

// TODO move to a composable?
// Trap focus within the modal when Tab or Shift+Tab is pressed
function handleTab(e: KeyboardEvent): void {
  const shell = modalShell.value
  if (!shell) return
  const focusable = Array.from(shell.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (focusable.length === 0) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  // If Shift+Tab is pressed and focus is on the first element, move focus to the last element. (Otherwise, shift+tab moves focus backward as normal)
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
  } 
  // If Tab is pressed and focus is on the last element, move focus to the first element. (Otherwise, tab moves focus forward as normal)
  else {
    if (document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

function handleClose(result?: unknown): void {
  uiStore.closeModal(result)
}

</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <!-- Modal backdrop -->
      <div v-if="uiStore.activeModal" class="modal-backdrop" @click.self="handleClose()" >

        <!-- Modal shell -->
        <div
          ref="modalShell"
          class="modal-shell"
          :class="uiStore.activeModal.config.className"
          role="dialog"
          aria-modal="true"
          @keydown.tab="handleTab"
        >
        <!-- Actual modal content, as defined by activeModal -->
          <component
            :is="uiStore.activeModal.config.component"
            v-bind="uiStore.activeModal.config.props ?? {}"
            @confirm="(result: unknown) => handleClose(result)"
            @cancel="handleClose()"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
}

.modal-shell {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-5);
  min-width: 320px;
  max-width: 560px;
  max-height: 80vh;
  overflow-y: auto;
  z-index: var(--z-modal);
}

.modal-shell.modal--wide {
  max-width: 720px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-fast) var(--ease-default);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
