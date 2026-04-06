<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

const props = withDefaults(
  defineProps<{
    items: unknown[]
    keyField: string
    estimateSize: number
    overscan?: number
  }>(),
  { overscan: 5 },
)

const scrollContainer = ref<HTMLElement | null>(null)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.items.length,
    getScrollElement: () => scrollContainer.value,
    estimateSize: () => props.estimateSize,
    overscan: props.overscan,
    getItemKey: (index: number) => {
      const item = props.items[index] as Record<string, unknown>
      return String(item?.[props.keyField] ?? index)
    },
  })),
)

function scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): void {
  virtualizer.value.scrollToIndex(index, { align })
}

defineExpose({ scrollToIndex })
</script>

<template>
  <div class="scrollable-list">
    <div v-if="$slots.header" class="scrollable-list__header">
      <slot name="header" />
    </div>
    <div ref="scrollContainer" class="scrollable-list__viewport">
      <div v-if="items.length === 0" class="scrollable-list__empty">
        <slot name="empty">
          <p class="text-muted">No items</p>
        </slot>
      </div>
      <div
        v-else
        :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }"
      >
        <div
          v-for="row in virtualizer.getVirtualItems()"
          :key="String(row.key)"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${row.start}px)`,
          }"
        >
          <slot name="item" :item="items[row.index]" :index="row.index" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollable-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.scrollable-list__header {
  flex-shrink: 0;
}

.scrollable-list__viewport {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.scrollable-list__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--color-text-muted);
}
</style>
