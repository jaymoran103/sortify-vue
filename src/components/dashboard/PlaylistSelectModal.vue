<script setup lang="ts">
import { computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlists'
import { useListFilter } from '@/composables/useListFilter'
import { useListSelection } from '@/composables/useListSelection'
import { useListSort } from '@/composables/useListSort'
import { useSelectedFirstDisplay } from '@/composables/useSelectedFirstDisplay'

import ControlBar from '@/components/common/ControlBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem from '@/components/common/SelectableItem.vue'
import type { Playlist } from '@/types/models'
import type { SortOption } from '@/types/ui'

const props = withDefaults(defineProps<{
  mode?: 'workspace' | 'export' | 'delete'
}>(), {
  mode: 'workspace',
})

const emit = defineEmits<{
  cancel: []
  confirm: [ids: number[]]
}>()

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

const { displayItems } = useSelectedFirstDisplay(
  sorted,
  selection.selectedIds,
  (item) => String(item.id!),
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
  const ids = [...selection.selectedIds.value].map(Number)
  emit('confirm', ids)
}
</script>

<template>
  <div class="selection-modal">
    <h2 class="selection-modal__title">Select Playlists</h2>

    <div class="selection-modal__body">
      <ControlBar>
        <SearchBar v-model="query" placeholder="Filter playlists…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />
      </ControlBar>

      <div class="selection-modal__list">
        <ScrollableList :items="displayItems" key-field="id" :estimate-size="56">
          <template #item="{ item }">
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
    </div>

    <div class="selection-modal__footer">
      <button class="btn btn--secondary playlist-select__select-all" @click="toggleSelectAll">
        {{ allSelected ? 'Deselect All' : 'Select All' }}
      </button>
      <div class="selection-modal__footer-actions">
        <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
        <button
          class="btn"
          :class="props.mode === 'delete' ? 'btn--danger' : 'btn--primary'"
          :disabled="selection.selectedIds.value.size === 0"
          @click="confirmSelection"
        >
          {{ props.mode === 'delete' ? 'Delete' : 'Open' }} ({{ selection.selectedCount.value }})
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playlist-select__select-all {
  flex-shrink: 0;
}
</style>
