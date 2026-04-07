<script setup lang="ts">
/**
 * PROTOTYPE C — Export Modal (simple, no transport step)
 * Since transport is chosen at card level, this modal goes straight
 * to playlist selection + format/profile.
 *
 * STATUS: UI prototype only.
 */
import { ref, computed } from 'vue'

const emit = defineEmits<{ cancel: [] }>()
const phase = ref<'options' | 'exporting' | 'done'>('options')

const mockPlaylists = [
  { id: 1, name: 'Morning Mix', tracks: 34 },
  { id: 2, name: 'Late Night', tracks: 52 },
  { id: 3, name: 'Workout', tracks: 18 },
  { id: 4, name: 'Focus Time', tracks: 41 },
]

const selectedIds = ref<Set<number>>(new Set())
const allSelected = computed(() => selectedIds.value.size === mockPlaylists.length)
const format = ref('csv')
const profile = ref('full')

function togglePlaylist(id: number) {
  const n = new Set(selectedIds.value)
  if (n.has(id)) n.delete(id)
  else n.add(id)
  selectedIds.value = n
}
function toggleAll() {
  selectedIds.value = allSelected.value
    ? new Set()
    : new Set(mockPlaylists.map((p) => p.id))
}
function simulateExport() {
  phase.value = 'exporting'
  setTimeout(() => { phase.value = 'done' }, 1000)
}
</script>

<template>
  <div class="proto-modal">
    <h2 class="proto-modal__title">Export to File</h2>

    <div v-if="phase === 'options'" class="proto-modal__body">
      <div class="proto-field">
        <label class="proto-field__label text-muted text-sm">Playlists</label>
        <div class="playlist-list">
          <label class="playlist-row playlist-row--all">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" />
            <span>All playlists</span>
          </label>
          <label v-for="pl in mockPlaylists" :key="pl.id" class="playlist-row">
            <input type="checkbox" :checked="selectedIds.has(pl.id)" @change="togglePlaylist(pl.id)" />
            <span>{{ pl.name }}</span>
            <span class="text-muted text-xs">{{ pl.tracks }}</span>
          </label>
        </div>
      </div>

      <div class="proto-field">
        <label class="proto-field__label text-muted text-sm">Format</label>
        <select v-model="format" class="sort-dropdown">
          <option value="csv">CSV File</option>
          <option value="json">JSON Bundle</option>
        </select>
      </div>
      <div v-if="format === 'csv'" class="proto-field">
        <label class="proto-field__label text-muted text-sm">Profile</label>
        <select v-model="profile" class="sort-dropdown">
          <option value="full">Full (all fields)</option>
          <option value="minimal">Minimal</option>
        </select>
      </div>
    </div>

    <div v-else-if="phase === 'exporting'" class="proto-modal__body">
      <p class="text-muted">Exporting…</p>
      <div class="proto-progress-bar"><div class="proto-progress-bar__fill proto-progress-bar__fill--indeterminate" /></div>
    </div>

    <div v-else-if="phase === 'done'" class="proto-modal__body">
      <p>Exported {{ selectedIds.size }} playlist(s). Check your downloads.</p>
    </div>

    <div class="proto-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">{{ phase === 'done' ? 'Done' : 'Cancel' }}</button>
      <button v-if="phase === 'options'" class="btn btn--primary" :disabled="selectedIds.size === 0" @click="simulateExport">
        Export ({{ selectedIds.size }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.proto-modal { padding: var(--space-5); min-width: 380px; display: flex; flex-direction: column; gap: var(--space-4); }
.proto-modal__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); }
.proto-modal__body { display: flex; flex-direction: column; gap: var(--space-4); }
.proto-modal__footer { display: flex; justify-content: flex-end; gap: var(--space-2); }

.proto-field { display: flex; flex-direction: column; gap: var(--space-2); }
.playlist-list {
  display: flex; flex-direction: column; gap: var(--space-1);
  max-height: 160px; overflow-y: auto;
  border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); padding: var(--space-2);
}
.playlist-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm);
  cursor: pointer; font-size: var(--font-size-sm);
}
.playlist-row:hover { background: var(--color-row-hover); }
.playlist-row--all { font-weight: var(--font-weight-medium); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-2); margin-bottom: var(--space-1); }
.playlist-row input[type="checkbox"] { accent-color: var(--color-accent); }

.sort-dropdown { padding: var(--space-2) var(--space-3); background: var(--color-surface-raised); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); color: var(--color-text); font-size: var(--font-size-sm); cursor: pointer; }

.proto-progress-bar { height: 4px; background: var(--color-surface-raised); border-radius: var(--radius-full); overflow: hidden; }
.proto-progress-bar__fill { height: 100%; background: var(--color-accent); border-radius: var(--radius-full); }
.proto-progress-bar__fill--indeterminate { width: 40%; animation: proto-shimmer 1.2s ease-in-out infinite; }
@keyframes proto-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
</style>
