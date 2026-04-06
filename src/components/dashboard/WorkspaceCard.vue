<script setup lang="ts">
import { useModal } from '@/composables/useModal'
import PlaylistSelectModal from './PlaylistSelectModal.vue'

const modal = useModal()

function openPlaylistSelect(): void {
  modal.open(PlaylistSelectModal)
}
</script>

<template>
  <div class="dashboard-card">
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Workspace</h2>
    </div>

    <p class="text-muted">Select playlists to start comparing and sorting tracks.</p>

    <button class="btn btn--primary" @click="openPlaylistSelect">Choose Playlists</button>
  </div>
</template>

<style scoped>
@import './card.css';
</style>
