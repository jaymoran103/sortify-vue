<script setup lang="ts">
import { computed } from 'vue'
import { dbStatus } from '@/db/dbInit'

const isBlocked = computed(() => dbStatus.value === 'blocked')
const isError = computed(() => dbStatus.value === 'error')
const isVisible = computed(() => isBlocked.value || isError.value)

// Action to clear IndexedDB and reload the page, used when an unrecoverable database error is encountered 
// Only necessary when stored versions cache a breaking change, contradictory to the version open, possibly due to a DB with the same name in a different tab
function clearAndReload() {
  indexedDB.deleteDatabase('SortifyDB')
  window.location.reload()
}
</script>

<template>
  <div v-if="isVisible" class="db-status-banner" :class="{ 'is-blocked': isBlocked, 'is-error': isError }">
    <!-- Blocked case display: Explain context to user, suggest action to resolve -->
    <template v-if="isBlocked">
      <strong>Database upgrade in progress</strong>
      <span> — Another Sortify tab is open. Close it and this page will continue automatically.</span>
    </template>
    <!-- Error case display: Explain context to user and possible actions to resolve. Provide a button to clear local data and reload the page -->
    <template v-else-if="isError">
      <strong>Database unavailable</strong>
      <span> — Your data could not be loaded. This may be because a newer version of Sortify has been used in this browser. Try refreshing, or </span>
      <button class="db-status-reset-btn" @click="clearAndReload">Clear site data and reload</button>
      <span> (removes all local data).</span>
    </template>
  </div>
</template>

<style scoped>
.db-status-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 10px 16px;
  font-size: 0.875rem;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.db-status-banner.is-blocked {
  background-color: var(--color-warning-bg, #fff3cd);
  color: var(--color-warning-text, #664d03);
  border-bottom: 1px solid var(--color-warning-border, #ffda6a);
}

.db-status-banner.is-error {
  background-color: var(--color-error-bg, #f8d7da);
  color: var(--color-error-text, #58151c);
  border-bottom: 1px solid var(--color-error-border, #f1aeb5);
}

.db-status-reset-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  color: inherit;
}

.db-status-reset-btn:hover {
  opacity: 0.75;
}
</style>
