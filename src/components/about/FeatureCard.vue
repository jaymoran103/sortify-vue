<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
  badge?: string
}>()
</script>

<template>
  <div class="feat-card" :class="{ 'feat-card-muted': !!badge }">
    <div v-if="badge" class="feat-card-badge">{{ badge }}</div>
    <div class="feat-card-icon">{{ icon }}</div>
    <div class="feat-card-body">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<style scoped>
.feat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
}
.feat-card:hover {
  background: var(--color-surface-raised);
  /* border-color: var(--color-border); */
}
.feat-card-muted { opacity: 0.5; }
.feat-card-muted:hover {  background: var(--color-surface);}
.feat-card-badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  font-size: var(--font-size-xs);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
}
.feat-card-icon {
  font-size: 1.4rem;
  line-height: 1;
  color: var(--color-text-muted);
}
.feat-card-body h3 {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--space-2);
}
.feat-card-body p {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}
</style>
