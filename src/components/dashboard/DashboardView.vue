<script setup lang="ts">
import { ref } from 'vue'
import { useTrackStore } from '@/stores/tracks'
import { usePlaylistStore } from '@/stores/playlists'
import { csvImportAdapter } from '@/adapters/csvImport'
import { csvExportAdapter } from '@/adapters/csvExport'

const trackStore = useTrackStore()
const playlistStore = usePlaylistStore()

const csvInput = ref<HTMLInputElement | null>(null)

async function onCsvFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  const result = await csvImportAdapter.import({ files })
  console.log('[CSV Import]', result)
  ;(e.target as HTMLInputElement).value = ''
}

async function exportCsv() {
  const result = await csvExportAdapter.export({ playlistIds: 'all', profile: 'full' })
  console.log('[CSV Export]', result)
}

async function clearAll() {
  await trackStore.clearTracks()
  await playlistStore.clearPlaylists()
  console.log('[Clear] DB wiped')
}
</script>

<template>
  <div class="dashboard-view">
    <h1>Dashboard</h1>

    <section class="io-panel">
      <h2>I/O Tester</h2>

      <div class="stats">
        <span>Tracks: {{ trackStore.trackCount }}</span>
        <span>Playlists: {{ playlistStore.playlistCount }}</span>
      </div>

      <div class="btn-row">
        <button @click="csvInput?.click()">Import CSV</button>
        <button @click="exportCsv">Export CSV (all)</button>
        <button class="danger" @click="clearAll">Clear DB</button>
      </div>

      <input ref="csvInput" type="file" accept=".csv" multiple hidden @change="onCsvFiles" />

    </section>
  </div>
</template>

<style scoped>
/* TODO move styling elsewhere */
.dashboard-view {
  padding: 1.5rem;
  color: var(--color-text);
}

.io-panel {
  margin-top: 1.5rem;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.io-panel h2 {
  margin: 0 0 1rem;
  font-size: var(--font-size-md);
}

.stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

button {
  padding: 0.4rem 0.85rem;
  background: var(--color-surface-hi);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: var(--font-size-sm);
}

button:hover {
  background: var(--color-row-hover);
}

button.danger {
  color: var(--color-button-danger);
  border-color: var(--color-button-danger);
}

button.danger:hover {
  background: var(--color-button-danger-hover);
  color: var(--color-button-text);
}

</style>
