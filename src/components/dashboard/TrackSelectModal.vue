<script setup lang="ts">
import { computed } from 'vue'
import { useTrackStore } from '@/stores/tracks'
import { useSelectableList } from '@/composables/useSelectableList'

import ControlBar from '@/components/common/ControlBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem from '@/components/common/SelectableItem.vue'
import type { Track } from '@/types/models'
import type { SortOption } from '@/types/ui'

// Neutral by default. Destructive styling is opt-in so a caller that omits these props
// gets a plain Confirm button rather than a red Delete one it did not ask for.
const props = withDefaults(
  defineProps<{
    excludeIds?: string[]
    confirmLabel?: string
    confirmVariant?: 'primary' | 'danger'
    /**
     * Shown when the list is empty because everything was excluded rather than filtered out.
     * The caller owns this string: only it knows why it excluded what it did.
     */
    excludedEmptyLabel?: string
  }>(),
  {
    excludeIds: () => [],
    confirmLabel: 'Confirm',
    confirmVariant: 'primary',
    excludedEmptyLabel: 'No tracks available to select.',
  },
)

const emit = defineEmits<{
  cancel: []
  confirm: [ids: string[]]
}>()

const trackStore = useTrackStore()

const excludeSet = computed(() => new Set(props.excludeIds))

// Excluded tracks are dropped before the filter/sort pipeline rather than at render time,
// so the confirm count, Select All, and the selected-first display all operate on the
// same candidate set.
const allTracks = computed((): Track[] =>
  (trackStore.tracks ?? []).filter((t: Track) => !excludeSet.value.has(t.trackID)),
)

const sortOptions: SortOption<Track>[] = [
  { key: 'title', label: 'Title', compareFn: (a, b) => a.title.localeCompare(b.title) },
  { key: 'artist', label: 'Artist', compareFn: (a, b) => a.artist.localeCompare(b.artist) },
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
} = useSelectableList<Track>({
  items: allTracks,
  keyFn: (item) => item.trackID,
  filterFn: (item, q) =>
    item.title.toLowerCase().includes(q.toLowerCase()) ||
    item.artist.toLowerCase().includes(q.toLowerCase()),
  sortOptions,
})

// "No matching tracks" blames a search the user may not have run. When the list is empty
// with no query active and candidates were excluded, the cause is the exclusion, so say so —
// this is where W1-H's "No New Tracks" pre-check ended up after D3 replaced it with excludeIds.
const emptyLabel = computed(() =>
  query.value.trim() === '' && excludeSet.value.size > 0
    ? props.excludedEmptyLabel
    : 'No matching tracks',
)

// Emit confirm with selected trackIDs when user confirms selection.
function confirmSelection(): void {
  const ids = [...selectedIds.value]
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
            :selected="isSelected((item as Track).trackID)"
            @toggle="toggle((item as Track).trackID)"
          />
        </template>
        <template #empty>
          <p class="text-muted track-select__empty">{{ emptyLabel }}</p>
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
        <!-- Label and variant come from the caller; see the props block for defaults. -->
        <button
          class="btn track-select__confirm"
          :class="confirmVariant === 'danger' ? 'btn--danger' : 'btn--primary'"
          :disabled="selectedCount === 0"
          @click="confirmSelection"
        >
          {{ confirmLabel }} ({{ selectedCount }})
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
