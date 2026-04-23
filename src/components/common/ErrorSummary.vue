<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ActivityError } from '@/types/ui'

const props = defineProps<{
  errors: ActivityError[]
}>()

const COLLAPSE_THRESHOLD = 3

// Group errors by category, preserving insertion order.
const groups = computed((): [string, ActivityError[]][] => {
  const map = new Map<string, ActivityError[]>()
  for (const err of props.errors) {
    const bucket = map.get(err.category) ?? []
    bucket.push(err)
    map.set(err.category, bucket)
  }
  return [...map.entries()]
})

const expandedCategories = ref(new Set<string>())

function toggleExpand(category: string): void {
  const next = new Set(expandedCategories.value)
  if (next.has(category)) {
    next.delete(category)
  } else {
    next.add(category)
  }
  expandedCategories.value = next
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    warning: 'Warnings',
    error: 'Errors',
    'rate-limit': 'Rate Limit',
  }
  return labels[category] ?? category.replace(/-/g, ' ')
}

// Returns true if a group should show a collapse toggle.
function isCollapsible(errs: ActivityError[]): boolean {
  return errs.length > COLLAPSE_THRESHOLD
}

// Safe CSS class suffix: replace slashes and spaces with hyphens.
function categoryCssClass(category: string): string {
  return `error-summary__group--${category.replace(/[/ ]/g, '-')}`
}
</script>

<template>
  <div v-if="groups.length > 0" class="error-summary">
    <div
      v-for="[category, errs] in groups"
      :key="category"
      class="error-summary__group"
      :class="categoryCssClass(category)"
    >
      <p class="error-summary__category-label">
        {{ categoryLabel(category) }}
        <span class="error-summary__count">({{ errs.length }})</span>
      </p>
      <ul class="error-summary__list">
        <template v-for="(err, i) in errs" :key="i">
          <li
            v-if="!isCollapsible(errs) || expandedCategories.has(category) || i < COLLAPSE_THRESHOLD"
            class="error-summary__item"
          >
            {{ err.message }}
            <ul v-if="err.items.length > 0" class="error-summary__sub-list">
              <li v-for="item in err.items" :key="item" class="error-summary__sub-item">{{ item }}</li>
            </ul>
          </li>
        </template>
      </ul>
      <button
        v-if="isCollapsible(errs)"
        class="error-summary__toggle text-sm"
        @click="toggleExpand(category)"
      >
        {{ expandedCategories.has(category) ? 'Show less' : `Show ${errs.length - COLLAPSE_THRESHOLD} more…` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.error-summary__group {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Category-specific border accent */
.error-summary__group--warning {
  border-left: 3px solid var(--color-text-muted);
}

.error-summary__group--error {
  border-left: 3px solid var(--color-danger);
}

.error-summary__group--rate-limit {
  border-left: 3px solid var(--color-info);
}

.error-summary__category-label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.error-summary__group--error .error-summary__category-label {
  color: var(--color-danger);
}

.error-summary__group--rate-limit .error-summary__category-label {
  /* color: var(--color-info); */
  color: var(--color-danger);
}

.error-summary__count {
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
  margin-left: var(--space-1);
}

.error-summary__list {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.error-summary__item {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.error-summary__sub-list {
  margin: var(--space-1) 0 0;
  padding-left: var(--space-3);
}

.error-summary__sub-item {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.error-summary__toggle {
  all: unset;
  cursor: pointer;
  color: var(--color-text-muted);
  text-decoration: underline;
  align-self: flex-start;
}

.error-summary__toggle:hover {
  color: var(--color-text);
}
</style>
