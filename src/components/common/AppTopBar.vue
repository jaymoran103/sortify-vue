<script setup lang="ts">
// Shared site chrome: identity on the left, route navigation in the middle, page-owned
// actions on the right. Peer views each grew their own header strip (dashboard's title +
// About button, workspace's Back button), so this exists to give /library the same shape
// without a fifth hand-rolled header. Nothing here is view-specific — a page contributes
// its own controls through the #actions slot.
import { RouterLink } from 'vue-router'

defineSlots<{
  actions?(): unknown
}>()

const links = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'library', label: 'Library' },
  { name: 'workspace', label: 'Workspace' },
  { name: 'about', label: 'About' },
]
</script>

<template>
  <header class="topbar">
    <RouterLink class="topbar__brand" :to="{ name: 'dashboard' }">Sortify</RouterLink>

    <nav class="topbar__nav">
      <RouterLink
        v-for="link in links"
        :key="link.name"
        class="topbar__link"
        active-class="topbar__link--active"
        :to="{ name: link.name }"
      >
        {{ link.label }}
      </RouterLink>
    </nav>

    <div class="topbar__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.topbar__brand {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: 0.02em;
}

.topbar__nav {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.topbar__link {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease-default),
    color var(--duration-fast) var(--ease-default);
}

.topbar__link:hover {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.topbar__link--active {
  color: var(--color-text);
  background: var(--color-accent-subtle);
}

/* Actions sit hard right whether or not the page supplies any. */
.topbar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}
</style>
