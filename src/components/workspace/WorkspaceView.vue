<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/sessions'
import { usePlaylistStore } from '@/stores/playlists'
import { useTrackStore } from '@/stores/tracks'
import type { Playlist, Track, WorkspaceSession } from '@/types/models'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const playlistStore = usePlaylistStore()
const trackStore = useTrackStore()

const session = ref<WorkspaceSession | null>(null)
const playlists = ref<Playlist[]>([])
const tracks = ref<Track[]>([])
const error = ref<string | null>(null)
const isLoading = ref(true)

// On component mount, load the session based on the 'session' query parameter. 
// Then load all playlists and tracks associated with that session. 
// Handle errors and loading state appropriately.
onMounted(async () => {
  const sessionId = Number(route.query.session)
  if (!sessionId || isNaN(sessionId)) {
    error.value = 'No session specified. Go back to the dashboard and select playlists.'
    isLoading.value = false
    return
  }

  // Load session data
  try {
    const loaded = await sessionStore.getSession(sessionId)
    if (!loaded) {
      error.value = 'Session not found.'
      isLoading.value = false
      return
    }
    session.value = loaded
    await sessionStore.touchSession(sessionId)

    // Load playlists
    const loadedPlaylists: Playlist[] = []
    for (const plId of loaded.playlistIds) {
      const pl = await playlistStore.getPlaylist(plId)
      if (pl) loadedPlaylists.push(pl)
    }
    playlists.value = loadedPlaylists

    // Collect unique track IDs and load tracks
    const trackIdSet = new Set<string>()
    for (const pl of loadedPlaylists) {
      for (const tid of pl.trackIDs) trackIdSet.add(tid)
    }
    tracks.value = await trackStore.getTracksByIds([...trackIdSet])
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load session.'
  } finally {
    isLoading.value = false
  }
})

function goBack(): void {
  router.push('/')
}
</script>

<template>
  <div class="workspace">
    <!-- Header -->
    <header class="workspace__header">

      <button class="btn btn--secondary" @click="goBack">Back to Dashboard</button>
      <h1 class="workspace__title">{{ session?.name ?? 'Workspace' }}</h1>

      <!-- Stats display, not crucial -->
      <span class="workspace__meta text-muted">
        {{ playlists.length }} playlists · {{ tracks.length }} tracks
      </span>
    </header>

    <!-- Error state -->
    <div v-if="error" class="workspace__error">
      <p>{{ error }}</p>
      <button class="btn btn--primary" @click="goBack">Back to Dashboard</button>
    </div>

    <!-- Loading state -->
    <div v-else-if="isLoading" class="workspace__loading">
      <p>Loading session…</p>
    </div>

    <!-- Track table -->
    <div v-else class="workspace__body">
      <div class="workspace__table-wrapper">
        <table class="workspace__table">
          <thead>
            <tr>
              <th class="workspace__th workspace__th--index">#</th>
              <th class="workspace__th workspace__th--track">Track</th>
              <th
                v-for="pl in playlists"
                :key="pl.id"
                class="workspace__th workspace__th--playlist"
              >
                {{ pl.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(track, i) in tracks" :key="track.trackID" class="workspace__row">
              <td class="workspace__cell workspace__cell--index">{{ i + 1 }}</td>
              <td class="workspace__cell workspace__cell--track">
                <div class="workspace__track-info">
                  <span class="workspace__track-title">{{ track.title }}</span>
                  <span class="workspace__track-artist text-muted">{{ track.artist }}</span>
                </div>
              </td>
              <td
                v-for="pl in playlists"
                :key="`${track.trackID}-${pl.id}`"
                class="workspace__cell workspace__cell--checkbox"
              >
                <input
                  type="checkbox"
                  :checked="pl.trackIDs.includes(track.trackID)"
                  disabled
                  :aria-label="`${track.title} in ${pl.name}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.workspace__header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  z-index: 10;
}

.workspace__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.workspace__error,
.workspace__loading {
  padding: var(--space-8) var(--space-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.workspace__body {
  flex: 1;
  overflow: auto;
}

.workspace__table-wrapper {
  min-width: 100%;
}

.workspace__table {
  width: 100%;
  border-collapse: collapse;
}

.workspace__table thead {
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: 5;
}

.workspace__th {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border-bottom: 1px solid var(--color-border-subtle);
  white-space: nowrap;
}

.workspace__th--index {
  width: 3rem;
}

.workspace__th--track {
  min-width: 220px;
}

.workspace__th--playlist {
  width: 120px;
  text-align: center;
}

/* .workspace__row:nth-child(even) {
  background: var(--color-surface-raised, var(--color-surface));
} */

.workspace__cell {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-sm);
}

.workspace__cell--index {
  color: var(--color-text-muted);
}

.workspace__cell--checkbox {
  text-align: center;
}

.workspace__track-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.workspace__track-title {
  font-weight: var(--font-weight-medium);
}

.workspace__track-artist {
  font-size: var(--font-size-xs);
}
</style>
