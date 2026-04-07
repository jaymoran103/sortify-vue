<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
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

// Get all playlists from the store, then chain filter and sort composables.
const allPlaylists = computed((): Playlist[] => playlistStore.playlists ?? [])

// Define sort options. Not emphasizing variety like asc/desc or many extra qualities. FUTURE: Add variety here once selected items have more relevant fields
const sortOptions: SortOption<Playlist>[] = [
  { key: 'name', label: 'Name', compareFn: (a, b) => a.name.localeCompare(b.name) },
  { key: 'trackCount', label: 'Track Count', compareFn: (a, b) => b.trackIDs.length - a.trackIDs.length },// Sorts descending 
  // { key: 'createdAt', label: 'Time Created', compareFn: (a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0) },
]


// Pure transformation pipeline: allPlaylists -> filtered -> sorted.
const { query, filtered } = useListFilter<Playlist>(
  allPlaylists,
  (item, q) => item.name.toLowerCase().includes(q.toLowerCase()),
)
const { currentSort, sorted } = useListSort<Playlist>(filtered, sortOptions)

// Determine selection state: orthogonal to the display pipeline.
// Pruning uses the data source, not the display list, so filtering does not cause phantom deselection.
const selection = useListSelection<Playlist>(
  sorted, (item) => String(item.id!),
  { selectMultiple: true },
  allPlaylists,
)

// Determine displayItems: sorted output prioritizing selections is applied on pipeline change
// Implemented as a watch (not computed) so that selection changes do not trigger a re-render. Only manual control updates (sort/filter) will reorder the list, so results don't jump around during selection. 
const displayItems = shallowRef<Playlist[]>([])
watch(
  sorted,
  (newSorted) => {
    const ids = selection.selectedIds.value // non-reactive snapshot: not a watch dependency
    displayItems.value = [...newSorted].sort((a, b) => {
      return (ids.has(String(a.id!)) ? 0 : 1) - (ids.has(String(b.id!)) ? 0 : 1)
    })
  },
  { immediate: true },
)

// allSelected: true when every currently visible (sorted/filtered) item is selected.
// NOTE: Items that are selected but not displayed don't factor into this computation. This is intentional. 
const allSelected = computed(
  () =>
    sorted.value.length > 0 &&
    sorted.value.every((item) => selection.isSelected(String(item.id!))),
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
