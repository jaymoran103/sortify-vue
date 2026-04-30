<script setup lang="ts">
defineProps<{ activeTab: number }>()

</script>

<template>
  <div class="mock-header">
    <span class="mock-title">Demo Session</span>
  </div>

  <div class="mock-body">
    <span v-if="activeTab === 1"  class="conditional-text">{{"Tab 2 View"}}</span>
    <span v-else-if="activeTab === 2"  class="conditional-text">{{"Tab 3 View"}}</span>
    <span v-else  class="conditional-text">{{"Tab 1 View"}}</span>
  </div>
</template>

<style scoped>

.mock-header {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-4) var(--space-5);
}
.mock-title {
  font-size: var(--font-size-md); 
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
.mock-body {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-top: none;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  padding: var(--space-5);
  min-height: 300px;
}
.conditional-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

</style>
