<script setup lang="ts">
import { computed } from 'vue'
import { useTrackStore } from '@/stores/tracks'
import { useModal } from '@/composables/useModal'
import ImportModal from './ImportModal.vue'
import ExportModal from './ExportModal.vue'

const trackStore = useTrackStore()
const trackCount = computed(() => trackStore.tracks?.length ?? 0)
const modal = useModal()

// Button Handlers
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
      <span class="dashboard-card__count">{{ trackCount }} tracks</span>
    </div>

    <div class="io-card__actions">
      <button id="import-button" class="btn btn--primary" @click="openImportModal">Import</button>
      <button id="export-button" class="btn btn--primary" @click="openExportModal" :disabled="trackCount === 0" > Export</button>
    </div>


  </div>
</template>

<style scoped>
@import './card.css';

.io-card__actions {
  display: flex;
  gap: var(--space-3);
}
</style>
