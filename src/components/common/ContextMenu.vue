<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useContextMenu } from '@/composables/useContextMenu'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import type { MenuItem } from '@/types/ui'

const ctx = useContextMenu()
const menuEl = ref<HTMLElement | null>(null)
  
// State management for outside click listener
let removeClickListener: (() => void) | null = null
let attachTimer: number | null = null

// Handle menu item click
function handleClick(entry: MenuItem): void {
  entry.action()
  ctx.close()
}

// Handle clicks outside the menu to close it
function handleOutsideClick(e: MouseEvent): void {
  if (menuEl.value && !menuEl.value.contains(e.target as Node)) {
    ctx.close()
  }
}

// Attach click listener on next tick after menu opens, avoiding immediate trigger from the click that opened the menu. 
// Remove listener when menu closes.
function attachOutsideClickListener(): void {
  removeClickListener = () => document.removeEventListener('click', handleOutsideClick)
  document.addEventListener('click', handleOutsideClick)
}

// Clear any pending timers and listeners when menu state changes or component unmounts
function cancelAttachTimer(): void {
  if (attachTimer !== null) {
    clearTimeout(attachTimer)
    attachTimer = null
  }
}

// Add/remove event listener for outside clicks when menu opens/closes
watch(
  () => ctx.isOpen.value,
  (open) => {
    if (open) {
      cancelAttachTimer()
      attachTimer = window.setTimeout(attachOutsideClickListener, 0)
    } else {
      cancelAttachTimer()
      removeClickListener?.()
      removeClickListener = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  cancelAttachTimer()
  removeClickListener?.()
})

useKeyboardShortcuts({
  escape: () => {
    if (ctx.isOpen.value) ctx.close()
  },
})
</script>

<template>
  <Teleport to="body">
    <!-- Context menu container -->
    <div
      v-if="ctx.isOpen.value"
      ref="menuEl"
      class="context-menu menu-panel"
      :style="{ top: `${ctx.position.value.y}px`, left: `${ctx.position.value.x}px` }"
      role="menu"
    >
    <!-- Menu entries -->
      <template v-for="(entry, i) in ctx.entries.value" :key="i">
        <!-- Divider  -->
        <hr v-if="'divider' in entry" class="context-menu__divider" />
        <!-- Else: Menu item -->
        <button
          v-else
          class="context-menu__item menu-item"
          role="menuitem"
          :disabled="entry.disabled"
          @click="handleClick(entry as MenuItem)"
        >
          {{ (entry as MenuItem).label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
/* Panel and item looks come from .menu-panel and .menu-item in utilities.css. */
.context-menu {
  position: fixed;
}

.context-menu__divider {
  margin: var(--space-1) 0;
  border: none;
  border-top: 1px solid var(--color-border-subtle);
}
</style>
