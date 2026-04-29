<script setup lang="ts">
  import { computed, watch } from 'vue'
import { useModal } from '@/composables/useModal'
import { usePlaylistStore } from '@/stores/playlists'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import { PENDING_ACTIONS } from '@/spotify/pendingIntent'
import ImportModal from './ImportModal.vue'
import ExportModal from './ExportModal.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'
import ActivityIndicator from '@/components/common/ActivityIndicator.vue'
import IOSummaryCard from '@/components/dashboard/IOSummaryCard.vue'

const modal = useModal()

// Access playlist store to determine if there are any playlists available. If not, "Choose Playlists" button is disabled withn a tooltip.
const playlistStore = usePlaylistStore()
const hasPlaylists = computed(() => (playlistStore.playlists ?? []).length > 0)

// Access Spotify auth state for status indicator and login action
const { isAuthenticated, user, isLoading, error, login, logout, pendingAction, clearPendingAction } = useSpotifyAuth()

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

// Watch for pending action set asynchronously after the OAuth callback completes.
// onMounted fires before handleSpotifyCallback() resolves, so a reactive watch is required.
// immediate: true also handles the (unlikely) case where the action was set before this component mounted.
watch(pendingAction, (action) => {
  if (action === PENDING_ACTIONS.OPEN_SPOTIFY_PICKER) {
    clearPendingAction()
    modal.open(ImportModal, { autoSpotify: true })
  } else if (action === PENDING_ACTIONS.OPEN_SPOTIFY_EXPORTER) {
    clearPendingAction()
    modal.open(ExportModal, { autoSpotify: true })
  }
}, { immediate: true })
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

    <!-- Recent Activity Summary: Persistent display of recently completed operations. Grows to fill available card space. -->
    <div class="io-card__summary-wrapper">
      <IOSummaryCard />
    </div>

    <!-- Card Footer: Spotify status + live activity indicator -->
    <div class="dashboard-card__footer io-card__footer">
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
         <!-- Display username if authenticated and available -->
        <span v-if="isLoading" class="text-muted text-sm">Connecting...</span>
        <span v-else-if="isAuthenticated" class="text-sm io-card__spotify-label--connected">
          Spotify Connected<template v-if="user?.display_name"> - {{ user.display_name }}</template>
        </span>
        <span v-else-if="error" class="text-sm io-card__spotify-label--error">{{ error }}</span>
        <span v-else class="text-muted text-sm">Spotify not connected</span>
      </button>

      <!-- Activity progress indicator: shows I/O operation status (import/export). Distinct from the Spotify status row above, which tracks auth state. -->
      <ActivityIndicator />
    </div>
  </div>
</template>

<style scoped>
@import './card.css';

.io-card__actions {
  display: flex;
  gap: var(--space-3);
}

/* Wrapper that allows IOSummaryCard to grow and scroll within the card flex layout. */
.io-card__summary-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.io-card__footer {
  flex-shrink: 0;
  flex-direction: column;
  gap: var(--space-2);
  justify-content: flex-start;
}

.io-card__spotify-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
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

