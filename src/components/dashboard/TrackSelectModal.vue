<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useTrackStore } from '@/stores/tracks'
import { useListFilter } from '@/composables/useListFilter'
import { useListSelection } from '@/composables/useListSelection'
import { useListSort } from '@/composables/useListSort'

import ControlBar from '@/components/common/ControlBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem from '@/components/common/SelectableItem.vue'
import type { Track } from '@/types/models'
import type { SortOption } from '@/types/ui'

const emit = defineEmits<{
  cancel: []
  confirm: [ids: string[]]
}>()

const trackStore = useTrackStore()

const allTracks = computed((): Track[] => trackStore.tracks ?? [])

const sortOptions: SortOption<Track>[] = [
  { key: 'title', label: 'Title', compareFn: (a, b) => a.title.localeCompare(b.title) },
  { key: 'artist', label: 'Artist', compareFn: (a, b) => a.artist.localeCompare(b.artist) },
]

// Pure transformation pipeline: allTracks -> filtered -> sorted.
const { query, filtered } = useListFilter<Track>(
  allTracks,
  (item, q) => item.title.toLowerCase().includes(q.toLowerCase()) || item.artist.toLowerCase().includes(q.toLowerCase()),
)
const { currentSort, sorted } = useListSort<Track>(filtered, sortOptions)

// Determine selection state: orthogonal to the display pipeline.
const selection = useListSelection<Track>(
  sorted,
  (item: Track) => item.trackID,
  { selectMultiple: true },
  allTracks,
)

// Prioritize selected items at the top when sort/filter changes, but not on every selection toggle.
// FUTURE: Contrast this approach and playlist select counterpart. Could unify with a "sticky selected" in the useSelectedFirstDisplay composable.
const displayItems = shallowRef<Track[]>([])
watch(
  sorted,
  (newSorted) => {
    const ids = selection.selectedIds.value
    displayItems.value = [...newSorted].sort((a, b) => {
      return (ids.has(a.trackID) ? 0 : 1) - (ids.has(b.trackID) ? 0 : 1)
    })
  },
  { immediate: true },
)


// allSelected: true when every currently visible (sorted/filtered) item is selected.
// NOTE: Items that are selected but not displayed don't factor into this computation. This is intentional.
const allSelected = computed(() =>
    displayItems.value.length > 0 &&
    displayItems.value.every((item) => selection.isSelected(item.trackID)),
)

// Toggle select all/deselect all based on current state.
function toggleSelectAll(): void {
  if (allSelected.value) {
    selection.clear()
  } else {
    selection.selectAll()
  }
}

// Emit confirm with selected trackIDs when user confirms selection.
function confirmSelection(): void {
  const ids = [...selection.selectedIds.value]
  emit('confirm', ids)
}
</script>

<template>
  <div class="track-select">
    <h2 class="track-select__title">Select Tracks</h2>

    <!-- Control bar with search and sort options -->
    <ControlBar>
      <SearchBar v-model="query" placeholder="Filter tracks…" />
      <SelectDropdown v-model="currentSort" :options="sortOptions" />
    </ControlBar>

    <!-- Track list with selection -->
    <div class="track-select__list">
      <ScrollableList :items="displayItems" key-field="trackID" :estimate-size="48">
        <template #item="{ item }">
          <SelectableItem
            :label="(item as Track).title"
            :subtitle="(item as Track).artist"
            :selected="selection.isSelected((item as Track).trackID)"
            @toggle="selection.toggle((item as Track).trackID)"
          />
        </template>
        <template #empty>
          <p class="text-muted">No matching tracks</p>
        </template>
      </ScrollableList>
    </div>


    <!-- Footer with select all and action buttons -->
    <div class="track-select__footer">
      <button class="btn btn--secondary track-select__select-all" @click="toggleSelectAll">
        {{ allSelected ? 'Deselect All' : 'Select All' }}
      </button>
      <div class="track-select__footer-actions">
        <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
        <button
          class="btn btn--danger"
          :disabled="selection.selectedIds.value.size === 0"
          @click="confirmSelection"
        >
          Delete ({{ selection.selectedCount.value }})
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track-select {
  padding: var(--space-5);
  min-width: 440px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.track-select__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.track-select__list {
  height: 320px;
  overflow: hidden;
  border-top: 1px solid var(--color-border-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
}

.track-select__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.track-select__footer-actions {
  display: flex;
  gap: var(--space-2);
}
</style>
