<script setup lang="ts">
/**
 * PROTOTYPE B — Transport Tabs Inside Modals
 * Card surface: Import + Export buttons (same footprint).
 * Each modal has a tab bar (Files | Spotify) across the top.
 * Spotify tab is disabled.
 *
 * STATUS: UI prototype only — no data layer integration.
 */
import { useModal } from '@/composables/useModal'
import ProtoBImportModal from './ProtoBImportModal.vue'
import ProtoBExportModal from './ProtoBExportModal.vue'

const modal = useModal()
const mockTrackCount = 247

function openImport() { modal.open(ProtoBImportModal) }
function openExport() { modal.open(ProtoBExportModal) }
</script>

<template>
  <div class="dashboard-card">
    <div class="proto-label">B — Tab Modals</div>
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Import / Export</h2>
      <span class="dashboard-card__count">{{ mockTrackCount }} tracks</span>
    </div>

    <div class="io-card__actions">
      <button class="btn btn--primary" @click="openImport">Import</button>
      <button class="btn btn--primary" @click="openExport">Export</button>
    </div>
  </div>
</template>

<style scoped>
@import '../card.css';

.proto-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
  margin-bottom: calc(-1 * var(--space-2));
}
.io-card__actions { display: flex; gap: var(--space-3); }
</style>
