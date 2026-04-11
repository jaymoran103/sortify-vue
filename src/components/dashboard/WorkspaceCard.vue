<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useModal } from '@/composables/useModal'
import { useSessionStore } from '@/stores/sessions'
import { usePlaylistStore } from '@/stores/playlists'
import PlaylistSelectModal from './PlaylistSelectModal.vue'

const modal = useModal()
const router = useRouter()
const sessionStore = useSessionStore()

// Access playlist store to determine if there are any playlists available. If not, "Choose Playlists" button is disabled withn a tooltip.
const playlistStore = usePlaylistStore()
const hasPlaylists = computed(() => (playlistStore.playlists ?? []).length > 0)

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

    <!-- Open Button: disabled if library is empty -->
    <button 
      class="btn btn--primary" 
      @click="openPlaylistSelect"
      :disabled="!hasPlaylists"
      :title="!hasPlaylists ? 'No playlists available, import some to get started' : ''"
    >
      Choose Playlists
    </button>

  </div>
</template>

<style scoped>
@import './card.css';
</style>
