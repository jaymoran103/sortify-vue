<script setup lang="ts">
/**
 * PROTOTYPE C — Split Card: Local I/O + Spotify I/O
 * Two separate cards displayed together.
 * Local card has import/export with inline playlist selection on export.
 * Spotify card shows connection status + stubbed sync actions.
 *
 * STATUS: UI prototype only — no data layer integration.
 */
import { ref } from 'vue'
import { useModal } from '@/composables/useModal'
import ProtoCExportModal from './ProtoCExportModal.vue'

const modal = useModal()
const mockTrackCount = 247

// --- Local card: import simulation ---
const importPhase = ref<'idle' | 'progress' | 'done'>('idle')
const importMsg = ref('')

function simulateImport(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files?.length) return
  importPhase.value = 'progress'
  setTimeout(() => {
    importMsg.value = `Imported 42 tracks`
    importPhase.value = 'done'
  }, 1200)
}

function resetImport() { importPhase.value = 'idle'; importMsg.value = '' }

function openExport() {
  modal.open(ProtoCExportModal)
}
</script>

<template>
  <!-- LOCAL FILES CARD -->
  <div class="dashboard-card proto-c-card">
    <div class="proto-label">C — Local Files</div>
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Local Files</h2>
      <span class="dashboard-card__count">{{ mockTrackCount }} tracks</span>
    </div>

    <!-- Import area -->
    <div v-if="importPhase === 'idle'" class="proto-c__actions">
      <label class="btn btn--primary proto-c__file-btn">
        Import
        <input type="file" accept=".csv,.json" multiple hidden @change="simulateImport" />
      </label>
      <button class="btn btn--primary" @click="openExport">Export</button>
    </div>

    <div v-else-if="importPhase === 'progress'" class="proto-c__status">
      <span class="proto-spinner" />
      <span class="text-muted text-sm">Importing…</span>
    </div>

    <div v-else-if="importPhase === 'done'" class="proto-c__status">
      <p class="text-sm">{{ importMsg }}</p>
      <button class="btn btn--secondary btn--sm" @click="resetImport">OK</button>
    </div>

    <p class="text-muted text-xs">CSV, JSON</p>
  </div>
</template>

<style scoped>
@import '../card.css';

.proto-label {
color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: calc(-1 * var(--space-2));
}

.proto-c__actions { display: flex; gap: var(--space-3); }
.proto-c__status { display: flex; align-items: center; gap: var(--space-3); }
.proto-c__file-btn { cursor: pointer; }

.btn--sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs);
}

/* Loading spinner */
.proto-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-subtle);
  border-top-color: var(--color-accent);
  border-radius: var(--radius-full);
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
