<script setup lang="ts">
import { computed } from 'vue'
import { useModal } from '@/composables/useModal'
import { usePlaylistStore } from '@/stores/playlists'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import ImportModal from './ImportModal.vue'
import ExportModal from './ExportModal.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'

const modal = useModal()

// Access playlist store to determine if there are any playlists available. If not, "Choose Playlists" button is disabled withn a tooltip.
const playlistStore = usePlaylistStore()
const hasPlaylists = computed(() => (playlistStore.playlists ?? []).length > 0)

// Access Spotify auth state for status indicator and login action
const { isAuthenticated, user, isLoading, error, login, logout } = useSpotifyAuth()

function openImportModal() {
  modal.open(ImportModal)
}

function openExportModal() {
  modal.open(ExportModal)
}
// Use modal to ask user to confirm logout action, then call logout function from useSpotifyAuth if confirmed. This is necessary because Spotify tokens are long-lived and there is no "soft" disconnect option.
async function offerLogout() {

  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Disconnect Spotify',
    message: 'Are you sure you want to disconnect from Spotify? This will not delete any playlists, but you will need to log in again to access them.',
    confirmLabel: 'Disconnect',
    cancelText: 'Stay Connected',
  })

  if (confirmed) {
    logout()
  }
}
</script>

<template>
  <div class="dashboard-card">
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Import / Export</h2>
    </div>

    <!-- Main Button Row -->
    <div class="io-card__actions">
      <button id="import-button" class="btn btn--primary" @click="openImportModal">Import</button>
      <button id="export-button" class="btn btn--primary" @click="openExportModal" :disabled="!hasPlaylists" :title="hasPlaylists ? '' : 'No playlists available'">Export</button>
    </div>

    <!-- Spotify Status Indicator -->
    <!-- FUTURE: Review @click / nested lambda functions. Logic works and looks alright, but might not be necessary if logout happens another way -->
    <button
      class="io-card__spotify-status"
      :class="{
        'io-card__spotify-status--connected': isAuthenticated,
        'io-card__spotify-status--loading': isLoading,
        'io-card__spotify-status--error': error,
      }"
      @click="
      isAuthenticated ? offerLogout()
                      : isLoading ? undefined
                                  : login()
      "
      :aria-label="isAuthenticated ? 'Spotify Connected' : 'Connect to Spotify'"

    >
    <!-- @click="!isAuthenticated && !isLoading ? login() : undefined" -->
      <span
        class="io-card__spotify-dot"
        :class="{
          'io-card__spotify-dot--connected': isAuthenticated,
          'io-card__spotify-dot--loading': isLoading,
          'io-card__spotify-dot--error': !!error,
        }"
      />
      <!-- Spotify Status Text: Display state based on isLoading, isAuthenticated, and error status -->
      <!-- TODO how best to handle delay before name is accessed?-->
      <span v-if="isLoading" class="text-muted text-sm">Connecting...</span>
      <span v-else-if="isAuthenticated" class="text-sm io-card__spotify-label--connected">
        Spotify Connected - {{ user?.display_name ?? 'username' }}
      </span>
      <span v-else-if="error" class="text-sm io-card__spotify-label--error">{{ error }}</span>
      <span v-else class="text-muted text-sm">Spotify not connected</span>
    </button>
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
  cursor: pointer;
  /*
  background: none;
  border-left: none;
  border-right: none;
  border-bottom: none;
  border-radius: 0;
  width: 100%;
  text-align: left;
  color: inherit;
  font: inherit;
  padding-left: 0;
  padding-right: 0;
  */
}

.io-card__spotify-status--connected {
  cursor: pointer;
}

.io-card__spotify-status--loading {
  cursor: default;
}

.io-card__spotify-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--gray-500);
  flex-shrink: 0;
}

.io-card__spotify-dot--connected {
  background: var(--green-400);
}

.io-card__spotify-dot--loading {
  background: var(--gray-400);
  animation: pulse 1s ease-in-out infinite;
}

.io-card__spotify-dot--error {
  background: #f59e0b;
}

.io-card__spotify-label--connected {
  color: var(--green-400);
}

.io-card__spotify-label--error {
  color: #f59e0b;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

