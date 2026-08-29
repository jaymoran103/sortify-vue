<script setup lang="ts">
import { computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlists'
import { useSelectableList } from '@/composables/useSelectableList'

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


const {
  query,
  currentSort,
  displayItems,
  selectedIds,
  selectedCount,
  isSelected,
  toggle,
  allSelected,
  toggleSelectAll,
} = useSelectableList<Playlist>({
  items: allPlaylists,
  keyFn: (item) => String(item.id!),
  filterFn: (item, q) => item.name.toLowerCase().includes(q.toLowerCase()),
  sortOptions,
})

// Emit confirm with selected playlist IDs when user confirms selection.
function confirmSelection(): void {
  const ids = [...selectedIds.value].map(Number)
  emit('confirm', ids)
}
</script>

<template>
  <div class="selection-modal">
    <h2 class="selection-modal__title">Select Playlists</h2>

    <!-- Control bar with search and sort options -->
    <div class="selection-modal__body">
      <ControlBar>
        <SearchBar v-model="query" placeholder="Filter playlists…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />
      </ControlBar>

    <!-- Playlist list with selection -->
      <div class="selection-modal__list">
        <ScrollableList :items="displayItems" key-field="id" :estimate-size="56">
          <template #item="{ item }">
            <SelectableItem
              :label="(item as Playlist).name"
              :subtitle="`${(item as Playlist).trackIDs.length} tracks`"
              :selected="isSelected(String((item as Playlist).id!))"
              @toggle="toggle(String((item as Playlist).id!))"
            />
          </template>
          <template #empty>
            <p class="text-muted">No matching playlists</p>
          </template>
        </ScrollableList>
      </div>
    </div>

    <!-- Footer with select all and action buttons -->
    <div class="selection-modal__footer">
      <button class="btn btn--secondary playlist-select__select-all" @click="toggleSelectAll">
        {{ allSelected ? 'Deselect All' : 'Select All' }}
      </button>
      <div class="selection-modal__footer-actions">
        <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
        <button
          class="btn"
          :class="props.mode === 'delete' ? 'btn--danger' : 'btn--primary'"
          :disabled="selectedCount === 0"
          @click="confirmSelection"
        >
          {{ props.mode === 'delete' ? 'Delete' : 'Open' }} ({{ selectedCount }})
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
