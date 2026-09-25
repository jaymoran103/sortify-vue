<script setup lang="ts">
import { computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlists'
import { useSelectableList } from '@/composables/useSelectableList'

import ControlBar from '@/components/common/ControlBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem, { SELECTABLE_ITEM_HEIGHT } from '@/components/common/SelectableItem.vue'
import type { Playlist } from '@/types/models'
import type { SortOption } from '@/types/ui'

const props = withDefaults(defineProps<{
  mode?: 'workspace' | 'export' | 'delete'
  /** Overrides the heading when the caller's flow is not "pick playlists to open". */
  title?: string
  /** Overrides the confirm label. `mode` still decides the button's danger styling. */
  confirmLabel?: string
  /** Ids checked when the modal opens — for edit flows that show current membership. */
  preselectedIds?: number[]
}>(), {
  mode: 'workspace',
  title: 'Select Playlists',
  confirmLabel: '',
  preselectedIds: () => [],
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

// Seed the checked set from the caller. Assigned rather than toggled one id at a time:
// useListSelection prunes ids absent from `items`, so a stale id drops itself on the next read.
if (props.preselectedIds.length > 0) {
  selectedIds.value = new Set(props.preselectedIds.map(String))
}

// Falls back to the mode's own verb when the caller does not name one.
const resolvedConfirmLabel = computed(
  () => props.confirmLabel || (props.mode === 'delete' ? 'Delete' : 'Open'),
)

// Emit confirm with selected playlist IDs when user confirms selection.
function confirmSelection(): void {
  const ids = [...selectedIds.value].map(Number)
  emit('confirm', ids)
}
</script>

<template>
  <div class="selection-modal">
    <h2 class="selection-modal__title">{{ props.title }}</h2>

    <!-- Control bar with search and sort options -->
    <div class="selection-modal__body">
      <ControlBar>
        <SearchBar v-model="query" placeholder="Filter playlists…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />
      </ControlBar>

    <!-- Playlist list with selection -->
      <div class="selection-modal__list">
        <ScrollableList :items="displayItems" key-field="id" :estimate-size="SELECTABLE_ITEM_HEIGHT">
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
      <button class="btn btn--secondary selection-modal__select-all" @click="toggleSelectAll">
        {{ allSelected ? 'Deselect All' : 'Select All' }}
      </button>
      <div class="selection-modal__footer-actions">
        <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
        <button
          class="btn"
          :class="props.mode === 'delete' ? 'btn--danger' : 'btn--primary'"
          :disabled="selectedCount === 0 && props.preselectedIds.length === 0"
          @click="confirmSelection"
        >
          {{ resolvedConfirmLabel }} ({{ selectedCount }})
        </button>
      </div>
    </div>
  </div>
</template>
