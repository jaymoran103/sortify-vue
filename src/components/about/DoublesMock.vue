<script setup lang="ts">
import { computed } from 'vue'
import type { DoublesCell, DoublesDraft } from './doublesDrafts'

const props = defineProps<{ activeTab: number; draft: DoublesDraft }>()

// The resting state (-1) shows the first tab
const state = computed(() => props.draft.states[Math.max(props.activeTab, 0)]!)
const gridColumns = computed(() => `40px minmax(200px, 1fr) repeat(${state.value.playlists.length}, minmax(90px, 130px))`)

const isOn = (cell: DoublesCell) => cell === 1 || cell === 'add' || cell === 'keep'
const cellMark: Record<string, string> = {
  add: '+',
  rm: '−',
}
</script>

<template>
  <!-- Header: same shape as the workspace mock -->
  <div class="ws-header">
    <span class="ws-title">{{ state.title }}</span>
    <span class="ws-meta">{{ state.meta }}</span>
    <div class="ws-header-actions">
      <span v-if="state.status" class="ws-unsaved">{{ state.status }}</span>
      <button class="ws-btn" :class="state.actionPrimary ? 'ws-btn-primary' : 'ws-btn-ghost'">{{ state.action }}</button>
    </div>
  </div>

  <div class="ws-table" :class="{ 'db-folded': state.folded }">
    <div class="ws-row ws-row-head" :style="{ gridTemplateColumns: gridColumns }">
      <div class="ws-cell ws-idx">#</div>
      <div class="ws-cell ws-track-col">Track</div>
      <div
        v-for="(pl, ci) in state.playlists"
        :key="pl"
        class="ws-cell ws-pl-col db-pl"
        :class="{ 'db-focus': state.focusCol?.index === ci }"
      >
        <span>{{ pl }}</span>
        <span v-if="state.focusCol?.index === ci" class="db-focus-note">{{ state.focusCol.note }}</span>
      </div>
    </div>

    <div
      v-for="(row, ri) in state.rows"
      :key="ri"
      class="ws-row"
      :class="row.mark && `db-row-${row.mark}`"
      :style="{ gridTemplateColumns: gridColumns }"
    >
      <div class="ws-cell ws-idx">{{ row.mark === 'playing' ? '▶' : ri + 1 }}</div>
      <div class="ws-cell ws-track-col">
        <span class="ws-track-title">{{ row.title }}</span>
        <span class="ws-track-artist">{{ row.artist }}</span>
      </div>
      <div
        v-for="(cell, ci) in row.cols"
        :key="ci"
        class="ws-cell ws-pl-col db-pl"
        :class="{ 'db-focus': state.focusCol?.index === ci }"
      >
        <span v-if="cell === 'pick' || cell === 'picked'" :class="['db-radio', cell === 'picked' && 'db-radio-on']"></span>
        <span
          v-else
          :class="['ws-checkbox', isOn(cell) && 'ws-checked', `db-cell-${cell}`]"
          :title="cell === 'keep' ? 'Kept as an exception' : undefined"
        >{{ isOn(cell) ? '✓' : cellMark[cell] ?? '' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './mock-shared.css';

/* Tab 0 of some drafts: only the list of versions. Playlist columns fold away. */
.db-pl { flex-direction: column; gap: 2px; transition: opacity 0.2s ease, background 0.2s ease; }
.db-folded .db-pl { opacity: 0; }

/* A column under discussion */
.db-focus { background: var(--color-accent-subtle); }
.db-focus-note { font-size: 10px; font-weight: var(--font-weight-normal); color: var(--color-accent-hover); }

/* Rows */
.db-row-preferred { background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
.db-row-muted .ws-track-col { opacity: 0.4; }
.db-row-playing .ws-idx { color: var(--color-accent-hover); }
.db-row-playing .ws-track-title { color: var(--color-accent-hover); }

/* Cells that changed or were kept on purpose */
.db-cell-add { box-shadow: 0 0 0 2px var(--color-accent-subtle); }
.db-cell-rm { border-color: var(--color-danger); color: var(--color-danger); font-size: 12px; }
.db-cell-keep { outline: 1px dashed var(--color-accent); outline-offset: 2px; }

/* An unapplied choice */
.db-radio {
  width: 15px; height: 15px;
  border-radius: 50%;
  border: 1px solid var(--color-border-subtle);
}
.db-radio-on { border: 5px solid var(--color-accent); }
</style>
