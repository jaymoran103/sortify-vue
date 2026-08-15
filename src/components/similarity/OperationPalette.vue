<script setup lang="ts">
import { computed, ref } from 'vue'
import SearchBar from '@/components/common/SearchBar.vue'
import { findAllPresets, isDoublesPreset } from '@/similarity/presets'

defineProps<{ activeKey: string }>()
defineEmits<{ select: [key: string] }>()

const query = ref('')

// Both operations' presets, in one list. The palette lists questions, not operations, so which
// computation answers a question is not something the user needs to see.
const visiblePresets = computed(() => findAllPresets(query.value))
</script>

<template>
  <aside class="operation-palette">
    <!-- Reserved for the ambient findings rail. Empty in this iteration; the slot exists so the
         rail lands here rather than forcing a layout change when it arrives. -->
    <slot name="rail" />

    <SearchBar v-model="query" placeholder="Search operations..." />

    <ul class="operation-palette__list">
      <li
        v-for="preset in visiblePresets"
        :key="preset.key"
        class="operation-palette__item"
        :class="{
          'operation-palette__item--active': preset.key === activeKey,
          'operation-palette__item--doubles': isDoublesPreset(preset.key),
        }"
        @click="$emit('select', preset.key)"
      >
        {{ preset.label }}
      </li>
    </ul>

    <p v-if="visiblePresets.length === 0" class="operation-palette__empty text-muted text-sm">
      No operations match "{{ query }}".
    </p>
  </aside>
</template>

<style scoped>
.operation-palette {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-right: 1px solid var(--color-border-subtle);
  background: var(--color-surface);
  overflow-y: auto;
}

.operation-palette__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.operation-palette__item {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-tight);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-default),
    color var(--duration-fast) var(--ease-default);
}

.operation-palette__item:hover {
  background: var(--color-row-hover);
  color: var(--color-text);
}

.operation-palette__item--active {
  background: var(--color-accent-subtle);
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.operation-palette__empty {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
