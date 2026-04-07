<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlists'
import { useListFilter } from '@/composables/useListFilter'
import { useListSelection } from '@/composables/useListSelection'
import { useListSort } from '@/composables/useListSort'

import ControlBar from '@/components/common/ControlBar.vue'
import SortDropdown from '@/components/common/SortDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem from '@/components/common/SelectableItem.vue'
import type { Playlist } from '@/types/models'
import type { SortOption } from '@/types/ui'

const emit = defineEmits<{
  cancel: []
}>()

const router = useRouter()
const playlistStore = usePlaylistStore()

// Get all playlists from the store, then chain filter, sort, and selection composables.
const allPlaylists = computed((): Playlist[] => playlistStore.playlists ?? [])

// Define sort options. Not emphasizing variety like asc/desc or many extra qualities. FUTURE: Add variety here once selected items have more relevant fields
const sortOptions: SortOption<Playlist>[] = [
  { key: 'name', label: 'Name', compareFn: (a, b) => a.name.localeCompare(b.name) },
  { key: 'trackCount', label: 'Track Count', compareFn: (a, b) => b.trackIDs.length - a.trackIDs.length },// Sorts descending 
  // { key: 'createdAt', label: 'Time Created', compareFn: (a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0) },
]

// Filter first, reducing set size.
const { query, filtered } = useListFilter<Playlist>(
  allPlaylists,
  (item, q) => item.name.toLowerCase().includes(q.toLowerCase()),
)
// Sort second, based on sortOptions and current selection.
const { currentSort, sorted } = useListSort<Playlist>(filtered, sortOptions)


// Then handle selection. Selection operates on the final displayed list, so it won't get messed up by filtering or sorting.
// TODO: This is not a pure transformation, should not be chained when selection is orthogonal to display scope.
//       Will fix with an additional reference set to serve as the basis for selection, decouplng from display logic.
// NOTE: Current state causes test 'Selections persist regardless of display scope)' to fail.
const selection = useListSelection<Playlist>(
  sorted, (item) => String(item.id!),
  { selectMultiple: true, selectedFirst: true },
)
const { displayItems } = selection

// Compute whether all currently sorted/filtered playlists are selected.
const allSelected = computed(
  () => sorted.value.length > 0 && selection.selectedCount.value === sorted.value.length,
)

// Toggle select all/deselect all based on current state.
function toggleSelectAll(): void {
  if (allSelected.value) {
    selection.clear()
  } else {
    selection.selectAll()
  }
}

function confirmSelection(): void {
  const ids = [...selection.selectedIds.value].join(',')
  router.push({ path: '/workspace', query: { playlists: ids } })
  emit('cancel')
}
</script>

<template>
  <div class="playlist-select">
    <h2 class="playlist-select__title">Select Playlists</h2>

    <ControlBar>
      <SearchBar v-model="query" placeholder="Filter playlists…" />
      <SortDropdown v-model="currentSort" :options="sortOptions" />
    </ControlBar>

    <div class="playlist-select__list">
      <ScrollableList :items="displayItems" key-field="id" :estimate-size="48">
        <template #item="{ item }">
          <!-- Playlist Item: Display name with track count as subtitle -->
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
      <button class="btn btn--secondary playlist-select__select-all" @click="toggleSelectAll">
        {{ allSelected ? 'Deselect All' : 'Select All' }}
      </button>
      <div class="playlist-select__footer-actions">
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
  </div>
</template>

<style scoped>
.playlist-select {
  padding: var(--space-5);
  min-width: 440px;
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
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.playlist-select__footer-actions {
  display: flex;
  gap: var(--space-2);
}
</style>
