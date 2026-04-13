<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Track } from '@/types/models'

const route = useRoute()
const router = useRouter()
const workspaceStore = useWorkspaceStore()

// Configure virtualizer: use the track list length, scroll container, and estimated row height. 
// Set overscan to 10 rows for now to balance performance and smoothness during scrolling.
const scrollContainer = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(
  computed(() => ({
    count: workspaceStore.trackList.length,
    getScrollElement: () => scrollContainer.value,
    estimateSize: () => 48,
    overscan: 10,
  })),
)
// On component mount, load the session based on the 'session' query parameter. 
onMounted(async () => {
  await workspaceStore.loadSession(Number(route.query.session))
})

// Reset store before unmounting to clear session data and avoid flash of stale content if user quickly opens another session.
onBeforeUnmount(() => {
  workspaceStore.$reset()
})

function goBack(): void {
  router.push('/')
}

// Helper to get track at a given index. Virtualizer provides the index, and we look up the track in the store's track list. 
function trackAt(index: number): Track {
  const track = workspaceStore.trackList[index]
  if (!track) throw new Error(`No track at index ${index}`)
  return track
}
</script>

<template>
  <div class="workspace">
    <!-- Header -->
    <header class="workspace__header">

      <button class="btn btn--secondary" @click="goBack">Back to Dashboard</button>
      <h1 class="workspace__title">{{ workspaceStore.sessionName || 'Workspace' }}</h1>

      <!-- Stats display, not crucial -->
      <span class="workspace__meta text-muted">
        {{ workspaceStore.playlists.length }} playlists · {{ workspaceStore.trackList.length }} tracks
      </span>
    </header>

    <!-- Error state -->
    <div v-if="workspaceStore.error" class="workspace__error">
      <p>{{ workspaceStore.error }}</p>
      <button class="btn btn--primary" @click="goBack">Back to Dashboard</button>
    </div>

    <!-- Loading state -->
    <div v-else-if="workspaceStore.isLoading" class="workspace__loading">
      <p>Loading session...</p>
    </div>

    <!-- Track table -->
    <div v-else ref="scrollContainer" class="workspace__body">

      <!-- Table Header: Titles for info columns and playlist titles  -->
      <div class="workspace__table-header">
        <div class="workspace__th workspace__th--index">#</div>
        <div class="workspace__th workspace__th--track">Track</div>
        <!-- Playlist columns: Generated per playlist in the store -->
        <div
          v-for="pl in workspaceStore.playlists"
          :key="pl.id"
          class="workspace__th workspace__th--playlist"
        >
          {{ pl.name }}
        </div>
      </div>

      <!-- Virtualized track list:  -->
      <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
        <div
          v-for="row in virtualizer.getVirtualItems()"
          :key="trackAt(row.index).trackID"
          class="workspace__row"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${row.size}px`,
            transform: `translateY(${row.start}px)`,
          }"
        >
          <!-- Track index column -->
          <div class="workspace__cell workspace__cell--index">{{ row.index + 1 }}</div>

          <!-- Track info column (Currently title, artist, with album hidden)-->
          <div class="workspace__cell workspace__cell--track">
            <div class="workspace__track-info">
              <span class="workspace__track-title">{{ trackAt(row.index).title }}</span>
              <!-- TODO: Could display track album too, but feels cluttered for now -->
              <!-- <span class="workspace__track-artist text-muted">{{ trackAt(row.index).artist+"•"+trackAt(row.index).album}}</span> -->
              <span class="workspace__track-artist text-muted">{{ trackAt(row.index).artist}}</span>
            </div>
          </div>

          <!-- Playlist header columns: one generated per playlist in store.  -->
          <!-- TODO: currently disabled until save functionality is implemented/wired -->
          <!-- FUTURE: Key field can facilitate column specific styling like row coloring -->
          <div
            v-for="pl in workspaceStore.playlists"
            :key="`${trackAt(row.index).trackID}-${pl.id}`"
            class="workspace__cell workspace__cell--checkbox"
          >
            <input
              type="checkbox"
              :checked="pl.trackIdSet.has(trackAt(row.index).trackID)"
              disabled
              :aria-label="`${trackAt(row.index).title} in ${pl.name}`"
            />
          </div>
        </div>
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
  position: relative;
}

.workspace__table-header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  z-index: 5;
}

.workspace__th {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace__th--index,
.workspace__cell--index {
  width: 3rem;
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.workspace__th--track,
.workspace__cell--track {
  flex: 1;
  min-width: 220px;
}

.workspace__th--playlist,
.workspace__cell--checkbox {
  width: 120px;
  flex-shrink: 0;
  text-align: center;
}

.workspace__row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border-subtle);
}

/* Lighten alternating rows  */
/* .workspace__row:nth-child(even) {
  background: var(--color-surface-raised, var(--color-surface));
} */

.workspace__cell {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  overflow: hidden;
}

.workspace__track-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.workspace__track-title {
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace__track-artist {
  font-size: var(--font-size-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
