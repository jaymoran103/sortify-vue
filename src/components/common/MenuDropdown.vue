<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { MenuEntry, MenuItem } from '@/types/ui'

// A control-bar button that opens a menu below it. The trigger looks like SelectDropdown
// and the panel like ContextMenu, so every control-bar menu reads as one set.
//
// Pass `entries` for a list of actions: picking one runs it and closes the menu. Or fill
// the default slot for anything else, such as checkboxes, and the menu stays open while
// the user picks. A click outside or Escape closes it either way.
withDefaults(
  defineProps<{
    label: string
    entries?: MenuEntry[]
    // Which edge of the trigger the panel lines up with. Use 'right' near the window's edge.
    align?: 'left' | 'right'
  }>(),
  { entries: () => [], align: 'left' },
)

const root = ref<HTMLDetailsElement | null>(null)

function close(): void {
  if (root.value) root.value.open = false
}

function pick(entry: MenuItem): void {
  close()
  entry.action()
}

function closeOnOutside(event: MouseEvent): void {
  if (root.value?.open && !root.value.contains(event.target as Node)) close()
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape' && root.value?.open) close()
}

onMounted(() => {
  document.addEventListener('click', closeOnOutside)
  document.addEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutside)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <details ref="root" class="menu-dropdown dropdown-wrapper">
    <summary class="dropdown">{{ label }}</summary>
    <div
      class="menu-dropdown__panel menu-panel"
      :class="`menu-dropdown__panel--${align}`"
      :role="entries.length ? 'menu' : 'group'"
      :aria-label="label"
    >
      <template v-for="(entry, i) in entries" :key="i">
        <hr v-if="'divider' in entry" class="menu-dropdown__divider" />
        <button
          v-else
          class="menu-item"
          type="button"
          role="menuitem"
          :disabled="entry.disabled"
          @click="pick(entry)"
        >
          {{ entry.label }}
        </button>
      </template>
      <slot />
    </div>
  </details>
</template>

<style scoped>
/* Looks come from .dropdown-wrapper, .dropdown, .menu-panel and .menu-item in
   utilities.css. Only the details-specific parts and placement live here. */
.menu-dropdown summary {
  display: block;
  list-style: none;
}

.menu-dropdown summary::-webkit-details-marker {
  display: none;
}

.menu-dropdown__panel {
  position: absolute;
  top: calc(100% + var(--space-1));
}

.menu-dropdown__panel--left {
  left: 0;
}

.menu-dropdown__panel--right {
  right: 0;
}

.menu-dropdown__divider {
  margin: var(--space-1) 0;
  border: none;
  border-top: 1px solid var(--color-border-subtle);
}
</style>
