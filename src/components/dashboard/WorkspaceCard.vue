<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useModal } from '@/composables/useModal'
import { useSessionStore } from '@/stores/sessions'
import PlaylistSelectModal from './PlaylistSelectModal.vue'

const modal = useModal()
const router = useRouter()
const sessionStore = useSessionStore()

// When the user clicks "Choose Playlists", open the PlaylistSelectModal.
async function openPlaylistSelect(): Promise<void> {
  const ids = await modal.open<number[]>(PlaylistSelectModal)
  if (!ids?.length) return
  const sessionId = await sessionStore.createSession(ids)
  router.push({ path: '/workspace', query: { session: String(sessionId) } })
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
