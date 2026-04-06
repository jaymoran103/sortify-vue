<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useContextMenu } from '@/composables/useContextMenu'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import type { MenuItem } from '@/types/ui'

const ctx = useContextMenu()
const menuEl = ref<HTMLElement | null>(null)

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

// Add/remove event listener for outside clicks when menu opens/closes
watch(
  () => ctx.isOpen.value,
  (open) => {
    if (open) {
      document.addEventListener('click', handleOutsideClick)
    } else {
      document.removeEventListener('click', handleOutsideClick)
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
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
      class="context-menu"
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
          class="context-menu__item"
          role="menuitem"
          @click="handleClick(entry as MenuItem)"
        >
          {{ (entry as MenuItem).label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-1) 0;
  min-width: 160px;
  z-index: var(--z-dropdown);
}

.context-menu__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  transition: background var(--duration-fast) var(--ease-default);
}

.context-menu__item:hover {
  background: var(--color-row-hover);
}

.context-menu__divider {
  margin: var(--space-1) 0;
  border: none;
  border-top: 1px solid var(--color-border-subtle);
}
</style>
