<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlists'
import { useListFilter } from '@/composables/useListFilter'
import { useListSelection } from '@/composables/useListSelection'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem from '@/components/common/SelectableItem.vue'
import type { Playlist } from '@/types/models'

const emit = defineEmits<{
  cancel: []
}>()

const router = useRouter()
const playlistStore = usePlaylistStore()

const allPlaylists = computed((): Playlist[] => playlistStore.playlists ?? [])

const { query, filtered } = useListFilter<Playlist>(
  allPlaylists,
  (item, q) => item.name.toLowerCase().includes(q.toLowerCase()),
)

const selection = useListSelection<Playlist>(filtered, (item) => String(item.id!))

// Navigates to workspace view with selected playlist IDs as query params, then closes modal
// FUTURE: validate selection, showing a warning if playlist count becomes too big to render nicely
function confirmSelection(): void {
  const ids = [...selection.selectedIds.value].join(',')
  router.push({ path: '/workspace', query: { playlists: ids } })
  emit('cancel')
}
</script>

<template>

  <div class="playlist-select">
    <h2 class="playlist-select__title">Select Playlists</h2>

    <SearchBar v-model="query" placeholder="Filter playlists…" />

    <!-- Selection window: ScrollableList with selectable items -->
    <div class="playlist-select__list">
      <ScrollableList :items="filtered" key-field="id" :estimate-size="48">
        <template #item="{ item }">
          <!-- I -->
          <SelectableItem
            :label="(item as Playlist).name"
            :subtitle="`${(item as Playlist).trackIDs.length} tracks`"
            :selected="selection.isSelected(String((item as Playlist).id!))"
            @toggle="selection.toggle(String((item as Playlist).id!))"
          />
        </template>
        <template #empty>
          <p class="text-muted">No matching playlists</p>
        </template>
      </ScrollableList>
    </div>

    <!-- Footer with action buttons -->
    <div class="playlist-select__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
      <button
        class="btn btn--primary"
        :disabled="selection.selectedIds.value.size === 0"
        @click="confirmSelection"
      >
        Open ({{ selection.selectedCount.value }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.playlist-select {
  padding: var(--space-5);
  min-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.playlist-select__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.playlist-select__list {
  height: 320px;
  overflow: hidden;
}

.playlist-select__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
