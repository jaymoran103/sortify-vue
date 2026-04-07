<script setup lang="ts">
/**
 * PROTOTYPE A — Stepped Modal Flow
 * Card surface: Import + Export buttons (same as current IOCard).
 * Each button opens a modal with an internal source-picker step,
 * then flows into the relevant options/progress/done steps.
 * Spotify option is stubbed/disabled.
 *
 * STATUS: UI prototype only — no data layer integration.
 */
import { useModal } from '@/composables/useModal'
import ProtoAImportModal from './ProtoAImportModal.vue'
import ProtoAExportModal from './ProtoAExportModal.vue'

const modal = useModal()
const mockTrackCount = 247

function openImport() {
  modal.open(ProtoAImportModal)
}

function openExport() {
  modal.open(ProtoAExportModal)
}
</script>

<template>
  <div class="dashboard-card">
    <div class="proto-label">A — Stepped Modal</div>
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Import / Export</h2>
      <span class="dashboard-card__count">{{ mockTrackCount }} tracks</span>
    </div>

    <div class="io-card__actions">
      <button class="btn btn--primary" @click="openImport">Import</button>
      <button class="btn btn--primary" @click="openExport">Export</button>
    </div>

    <div class="proto-spotify-status">
      <span class="proto-spotify-status__dot proto-spotify-status__dot--disconnected" />
      <span class="text-muted text-sm">Spotify not connected</span>
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

.io-card__actions {
  display: flex;
  gap: var(--space-3);
}

.proto-spotify-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-subtle);
}

.proto-spotify-status__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.proto-spotify-status__dot--disconnected {
  background: var(--gray-500);
}

.proto-spotify-status__dot--connected {
  background: var(--green-400);
}
</style>
