<!-- Drop zone and file picker for JSON bundles, with a per-file report of the last import. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHistoryStore } from '@/stores/history'

const store = useHistoryStore()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

// Counts dragenter/dragleave pairs, since both fire again on every child element.
let dragDepth = 0

function onDragEnter(): void {
  dragDepth++
  dragging.value = true
}
function onDragLeave(): void {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}
function onDrop(e: DragEvent): void {
  dragDepth = 0
  dragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) void store.importFiles(files)
}
function onPick(): void {
  const files = input.value?.files
  if (files?.length) void store.importFiles(files)
  // Reset so picking the same files again still fires change.
  if (input.value) input.value.value = ''
}

const summary = computed(() => {
  const r = store.lastReport
  if (!r.length) return ''
  const n = (s: string) => r.filter((x) => x.status === s).length
  const parts = [`${n('added')} added`]
  if (n('duplicate')) parts.push(`${n('duplicate')} already loaded`)
  if (n('error')) parts.push(`${n('error')} failed`)
  return parts.join(', ')
})

// Only files with something to say get a row. Clean adds are covered by the summary.
const notable = computed(() => store.lastReport.filter((r) => r.status !== 'added' || r.warnings.length))
</script>

<template>
  <section class="snapshot-import">
    <div
      class="snapshot-import__zone"
      :class="{ 'snapshot-import__zone--active': dragging }"
      data-testid="drop-zone"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <p class="snapshot-import__lead">Drop JSON bundles here, any number at once.</p>
      <p class="text-muted text-sm">Each bundle is one snapshot, dated by its <code>exportedAt</code>.</p>
      <div class="snapshot-import__actions">
        <button class="btn btn--primary" :disabled="store.importing" @click="input?.click()">Choose files</button>
        <button
          v-if="store.snapshots.length"
          class="btn btn--ghost"
          :disabled="store.importing"
          @click="store.clear()"
        >Clear all</button>
      </div>
      <input
        ref="input"
        class="sr-only"
        type="file"
        accept=".json,application/json"
        multiple
        data-testid="file-input"
        @change="onPick"
      />
    </div>

    <p v-if="store.importing" class="text-sm" role="status">
      Reading {{ store.progress.done + 1 }} of {{ store.progress.total }}…
    </p>
    <div v-else-if="summary" class="snapshot-import__report" role="status">
      <p class="text-sm">Last import: {{ summary }}.</p>
      <ul v-if="notable.length" class="snapshot-import__list">
        <li v-for="(r, i) in notable" :key="i" :class="`snapshot-import__item--${r.status}`">
          <span class="snapshot-import__file">{{ r.fileName }}</span>
          <span v-if="r.message"> {{ r.message }}</span>
          <span v-for="(w, wi) in r.warnings" :key="wi" class="text-muted"> {{ w }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.snapshot-import {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.snapshot-import__zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5);
  border: 2px dashed var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  text-align: center;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.snapshot-import__zone--active {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
}

.snapshot-import__lead {
  font-size: var(--font-size-md);
}

.snapshot-import__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.snapshot-import__list {
  list-style: none;
  padding: 0;
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-sm);
}

.snapshot-import__file {
  font-weight: var(--font-weight-medium);
  margin-right: var(--space-2);
}

.snapshot-import__item--error .snapshot-import__file {
  color: var(--color-danger-hover);
}

.snapshot-import__item--duplicate .snapshot-import__file {
  color: var(--color-warning);
}
</style>
