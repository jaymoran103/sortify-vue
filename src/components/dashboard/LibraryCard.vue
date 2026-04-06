<script setup lang="ts">
import { computed } from 'vue'
import { useTrackStore } from '@/stores/tracks'
import { usePlaylistStore } from '@/stores/playlists'
import ScrollableList from '@/components/common/ScrollableList.vue'
import type { Playlist } from '@/types/models'

//TODO: for UI placeholder for library view, use of modal probably isn't permanent
import { useModal } from '@/composables/useModal'
import ConfirmModal from '../modals/ConfirmModal.vue';
const modal = useModal()

const trackStore = useTrackStore()
const playlistStore = usePlaylistStore()

const trackCount = computed(() => trackStore.tracks?.length ?? 0)
const playlists = computed((): Playlist[] => playlistStore.playlists ?? [])
const playlistCount = computed(() => playlists.value.length)

//TODO: for UI placeholder for library view, use of modal probably isn't permanent
function openLibrary(): void {
  modal.open(ConfirmModal, {
    title: 'Not implemented yet',
    message: 'Coming soon!',
    confirmText: 'Ok',
  })
}

</script>

<template>
  <div class="dashboard-card library-card">
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Library</h2>
      <span class="dashboard-card__count">
        {{ trackCount }} tracks &middot; {{ playlistCount }} playlists
      </span>
    </div>

    <div class="library-card__list">
      <ScrollableList :items="playlists" key-field="id" :estimate-size="40">
        <template #item="{ item }">
          <div class="library-card__row">
            <span class="library-card__name">{{ (item as Playlist).name }}</span>
            <span class="library-card__meta text-muted text-sm">
              {{ (item as Playlist).trackIDs.length }} tracks
            </span>
          </div>
        </template>
        <template #empty>
          <p class="text-muted">No playlists yet. Import some tracks to get started.</p>
        </template>
      </ScrollableList>
    </div>
    <!-- TODO temporary modal to avoid navigating to a stub page -->
    <button class="btn btn--secondary library-card__link" @click="openLibrary">View Library</button>
    <!-- 
    <router-link to="/library" class="btn btn--secondary library-card__link">
      View Library
    </router-link>
    -->
  
  </div>
</template>

<style scoped>
@import './card.css';

.library-card {
  min-height: 240px;
}

.library-card__list {
  flex: 1;
  min-height: 120px;
  overflow: hidden;
}

.library-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  font-size: var(--font-size-sm);
}

.library-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-card__link {
  align-self: flex-start;
}
</style>
