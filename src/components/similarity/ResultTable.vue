<script setup lang="ts">
import { computed } from 'vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import type { ResultRow } from '@/similarity/types'

const props = defineProps<{
  rows: ResultRow[]
  selectedKeys: Set<string>
  emptyMessage: string
}>()

defineEmits<{ rowClick: [key: string, event: MouseEvent] }>()

// Columns come from the rows themselves, which is how one table serves more than one operation.
// A second operation supplies different measures and reuses this component unchanged.
const columns = computed(() => props.rows[0]?.measures ?? [])

const gridTemplate = computed(
  () => `minmax(180px, 2fr) repeat(${columns.value.length}, minmax(90px, 1fr))`,
)
</script>

<template>
  <div class="result-table">
    <div class="result-table__row result-table__head" :style="{ gridTemplateColumns: gridTemplate }">
      <div class="result-table__cell result-table__cell--label">Result</div>
      <div
        v-for="column in columns"
        :key="column.key"
        class="result-table__cell result-table__cell--measure"
      >
        {{ column.label }}
      </div>
    </div>

    <ScrollableList :items="rows" key-field="key" :estimate-size="56">
      <template #item="{ item }">
        <div
          class="result-table__row"
          :class="{ 'result-table__row--selected': selectedKeys.has((item as ResultRow).key) }"
          :style="{ gridTemplateColumns: gridTemplate }"
          @click="$emit('rowClick', (item as ResultRow).key, $event)"
        >
          <div class="result-table__cell result-table__cell--label">
            <!-- sizeTitle is the dedupe disclosure: it is present only when a playlist's unique
                 track count differs from its raw entry count. -->
            <span class="result-table__label" :title="(item as ResultRow).sizeTitle">
              {{ (item as ResultRow).primaryLabel }}
            </span>
            <span v-if="(item as ResultRow).secondaryLabel" class="result-table__sub text-muted text-xs">
              {{ (item as ResultRow).secondaryLabel }}
            </span>
            <span class="result-table__denominator text-muted text-xs">
              {{ (item as ResultRow).denominator }}
            </span>
          </div>

          <div
            v-for="measure in (item as ResultRow).measures"
            :key="measure.key"
            class="result-table__cell result-table__cell--measure"
          >
            <span v-if="measure.bar !== undefined" class="result-table__bar-wrap">
              <span class="result-table__bar" :style="{ width: `${measure.bar * 100}%` }"></span>
            </span>
            <span class="result-table__value">{{ measure.display }}</span>
          </div>
        </div>
      </template>

      <template #empty>
        <p class="result-table__empty text-muted">{{ emptyMessage }}</p>
      </template>
    </ScrollableList>
  </div>
</template>

<style scoped>
.result-table {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.result-table__row {
  display: grid;
  align-items: center;
  gap: var(--space-2);
  min-height: 56px;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.result-table__row:hover {
  background: var(--color-row-hover);
}

.result-table__row--selected {
  background: var(--color-accent-subtle);
}

.result-table__head {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  min-height: 0;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-xs);
  cursor: default;
}

.result-table__head:hover {
  background: var(--color-surface-raised);
}

.result-table__cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  overflow: hidden;
}

.result-table__cell--label {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.result-table__cell--measure {
  justify-content: flex-end;
}

.result-table__label,
.result-table__sub {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Bar styling ported from the About page's SimilarityMock, so the shipped view matches the
   promise users have already seen. */
.result-table__bar-wrap {
  flex: 1;
  min-width: 20px;
  height: 4px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  overflow: hidden;
}

.result-table__bar {
  display: block;
  height: 100%;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
}

.result-table__value {
  min-width: 4ch;
  text-align: right;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.result-table__empty {
  padding: var(--space-4);
  text-align: left;
}

.result-table .scrollable-list__empty {
  align-items: flex-start;
  justify-content: flex-start;
  padding: var(--space-4);
}
</style>
