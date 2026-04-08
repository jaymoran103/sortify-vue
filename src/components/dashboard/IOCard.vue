<script setup lang="ts">
import { useModal } from '@/composables/useModal'
import ImportModal from './ImportModal.vue'
import ExportModal from './ExportModal.vue'

const modal = useModal()

function openImportModal() {
  modal.open(ImportModal)
}

function openExportModal() {
  modal.open(ExportModal)
}
</script>

<template>
  <div class="dashboard-card">
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Import / Export</h2>
    </div>

    <div class="io-card__actions">
      <button id="import-button" class="btn btn--primary" @click="openImportModal">Import</button>
      <button id="export-button" class="btn btn--primary" @click="openExportModal">Export</button>
    </div>

    <div class="io-card__spotify-status">
      <span class="io-card__spotify-dot" />
      <span class="text-muted text-sm">Spotify not connected <span class="text-xs">(coming soon)</span></span>
    </div>
  </div>
</template>

<style scoped>
@import './card.css';

.io-card__actions {
  display: flex;
  gap: var(--space-3);
}

.io-card__spotify-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
}

.io-card__spotify-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--gray-500);
  flex-shrink: 0;
}
</style>

