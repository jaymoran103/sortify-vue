<script setup lang="ts">
import type { RailFinding } from '@/stores/similarity'

defineProps<{ findings: RailFinding[]; isStale: boolean }>()
defineEmits<{ select: [presetKey: string] }>()
</script>

<template>
  <!--
    The rail is the preset list run ahead of time, showing only presets that returned something.
    It hides itself entirely when the index is stale rather than asserting things about a library
    that has since changed, and stays silent when there is nothing to notice: an empty rail that
    says "nothing found" is chrome, not a finding.
  -->
  <nav v-if="!isStale && findings.length > 0" class="noticed-rail">
    <h2 class="noticed-rail__title">Noticed</h2>
    <ul class="noticed-rail__list">
      <li v-for="finding in findings" :key="finding.presetKey">
        <button class="noticed-rail__item" @click="$emit('select', finding.presetKey)">
          <span class="noticed-rail__count">{{ finding.count }}</span>
          <span class="noticed-rail__label">{{ finding.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.noticed-rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
}

.noticed-rail__title {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.noticed-rail__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.noticed-rail__item {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default);
}

.noticed-rail__item:hover {
  background: var(--color-row-hover);
}

.noticed-rail__count {
  flex-shrink: 0;
  min-width: 2ch;
  color: var(--color-accent-hover);
  font-weight: var(--font-weight-semibold);
}

.noticed-rail__label {
  line-height: var(--line-height-tight);
}
</style>
