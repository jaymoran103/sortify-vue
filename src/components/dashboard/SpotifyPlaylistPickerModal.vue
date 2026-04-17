<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import { useListFilter } from '@/composables/useListFilter'
import { useListSelection } from '@/composables/useListSelection'
import { useListSort } from '@/composables/useListSort'
import { useActivityStore } from '@/stores/activity'
import { getImporter } from '@/adapters/registry'
import type { SpotifyImportOptions } from '@/adapters/spotifyImport'
import { spotifyApi } from '@/spotify/api'
import ControlBar from '@/components/common/ControlBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem from '@/components/common/SelectableItem.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import type { ImportResult } from '@/types/adapters'
import type { SpotifyPlaylistSummary, SpotifyPaginatedResponse } from '@/spotify/types'
import type { SortOption } from '@/types/ui'

const emit = defineEmits<{
  cancel: []
  confirm: [result: ImportResult]
}>()

const activityStore = useActivityStore()
const { isAuthenticated, login } = useSpotifyAuth()

const step = ref<'loading' | 'ready' | 'progress' | 'done' | 'error'>('loading')
const playlists = ref<SpotifyPlaylistSummary[]>([])
const displayItems = shallowRef<SpotifyPlaylistSummary[]>([])
const result = ref<ImportResult | null>(null)
const errorMsg = ref<string | null>(null)
const progress = ref<number>(-1)

const sortOptions: SortOption<SpotifyPlaylistSummary>[] = [
  { key: 'name', label: 'Name', compareFn: (a, b) => a.name.localeCompare(b.name) },
  { key: 'trackCount', label: 'Track Count', compareFn: (a, b) => b.tracks.total - a.tracks.total },
]

const { query, filtered } = useListFilter<SpotifyPlaylistSummary>(
  playlists,
  (item, q) => item.name.toLowerCase().includes(q.toLowerCase()),
)
const { currentSort, sorted } = useListSort<SpotifyPlaylistSummary>(filtered, sortOptions)
const selection = useListSelection<SpotifyPlaylistSummary>(sorted, (item) => item.id, { selectMultiple: true }, playlists)

watch(
  sorted,
  (newSorted) => {
    const ids = selection.selectedIds.value
    displayItems.value = [...newSorted].sort((a, b) => {
      return (ids.has(a.id) ? 0 : 1) - (ids.has(b.id) ? 0 : 1)
    })
  },
  { immediate: true },
)

// Extracts Spotify API endpoint from a full URL or path, ensuring it starts with '/v1/' as expected by the spotifyApi instance. 
// This facilitates handling of 'next' URLs from Spotify's paginated responses
function parseSpotifyEndpoint(next: string): string {
  return next.startsWith('http') ? `${new URL(next).pathname}${new URL(next).search}` : next
}

// Fetches the user's Spotify playlists, handling pagination and potential data inconsistencies. 
// Uses helper to normalize playlist data for use in the component, and log any issues encountered during fetching and normalization of data
async function fetchPlaylists(): Promise<void> {
  step.value = 'loading'
  errorMsg.value = null

  if (!isAuthenticated.value) {
    errorMsg.value = 'Spotify is not connected. Please sign in and try again.'
    step.value = 'error'
    return
  }

  const fetched: SpotifyPlaylistSummary[] = []
  try {
    let endpoint = '/me/playlists?limit=50'
    // Loop through paginated results, fetching and normalizing playlist data, and accumulating it in the 'fetched' array.
    // rate throttling is handled by spotifyApi instance, so we can simply loop through pages, awaiting results and trusting the source to manage pacing.
    while (endpoint) {
      const page = await spotifyApi.get<SpotifyPaginatedResponse<SpotifyPlaylistSummary>>(endpoint)
      fetched.push(...page.items)
      endpoint = page.next ? parseSpotifyEndpoint(page.next) : ''
    }
    playlists.value = fetched
    step.value = 'ready'
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to fetch playlists'
    step.value = 'error'
  }
}

async function startImport(): Promise<void> {
  const selected = playlists.value.filter((item) => selection.isSelected(item.id))
  if (selected.length === 0) return

  step.value = 'progress'
  progress.value = -1
  errorMsg.value = null
  result.value = null

  activityStore.startOperation('spotify-import', 'Importing from Spotify')

  // Get and validate the Spotify import adapter
  const spotifyAdapter = getImporter<SpotifyImportOptions>('spotify')
  if (!spotifyAdapter) {
    const message = 'Spotify importer not registered'
    errorMsg.value = message
    step.value = 'error'
    activityStore.failOperation('spotify-import', message)
    return
  }

  const totalTracks = selected.reduce((sum, item) => sum + (item.tracks.total ?? 0), 0)

  // Call the import method of the Spotify adapter, passing the selected playlists and a progress callback to update the UI and activity store.
  try {
    const response = await spotifyAdapter.import(
      { playlists: selected },
      (done, _total, label) => {
        progress.value = totalTracks > 0 ? done / totalTracks : -1
        activityStore.updateProgress('spotify-import', {
          done,
          total: totalTracks,
          phase: 'Importing Spotify',
          itemLabel: label,
        })
      },
    )
    result.value = response
    step.value = 'done'
    activityStore.completeOperation('spotify-import')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Spotify import failed'
    errorMsg.value = message
    step.value = 'error'
    activityStore.failOperation('spotify-import', message)
  }
}

function handleRetry(): void {
  if (!isAuthenticated.value) {
    login()
    return
  }
  fetchPlaylists()
}

function handleCancel(): void {
  emit('cancel')
}

onMounted(fetchPlaylists)
</script>

<template>
  <div class="spotify-picker-modal">
    <h2 class="spotify-picker-modal__title">Import from Spotify</h2>

    <div v-if="step === 'loading'" class="spotify-picker-modal__body">
      <p class="text-muted">Loading playlists…</p>
      <ProgressBar :progress="-1" />
    </div>

    <div v-else-if="step === 'error'" class="spotify-picker-modal__body">
      <p class="io-modal__error">{{ errorMsg }}</p>
      <button class="btn btn--secondary" @click="handleRetry">
        {{ isAuthenticated ? 'Try Again' : 'Connect to Spotify' }}
      </button>
    </div>

    <div v-else-if="step === 'ready'" class="spotify-picker-modal__body">
      <ControlBar>
        <SearchBar v-model="query" placeholder="Filter playlists…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />
      </ControlBar>

      <div class="spotify-picker-modal__list">
        <ScrollableList :items="displayItems" key-field="id" :estimate-size="56">
          <template #item="{ item }">
            <SelectableItem
              :label="(item as SpotifyPlaylistSummary).name"
              :subtitle="`${(item as SpotifyPlaylistSummary).tracks.total} tracks — ${(item as SpotifyPlaylistSummary).owner.display_name}`"
              :selected="selection.isSelected((item as SpotifyPlaylistSummary).id)"
              @toggle="selection.toggle((item as SpotifyPlaylistSummary).id)"
            />
          </template>
          <template #empty>
            <p class="text-muted">No matching playlists</p>
          </template>
        </ScrollableList>
      </div>
    </div>

    <div v-else-if="step === 'progress'" class="spotify-picker-modal__body">
      <p class="text-muted">Importing selected playlists…</p>
      <ProgressBar :progress="progress" />
    </div>

    <div v-else-if="step === 'done' && result" class="spotify-picker-modal__body">
      <p>
        Imported <strong>{{ result.tracksImported }}</strong> track{{ result.tracksImported !== 1 ? 's' : '' }}
      </p>
      <p v-if="result.playlistsImported > 0">
        and {{ result.playlistsImported }} playlist{{ result.playlistsImported !== 1 ? 's' : '' }}
      </p>
      <p v-if="result.errors.length > 0" class="io-modal__error">
        {{ result.errors.length }} error(s) during import
      </p>
    </div>

    <div class="spotify-picker-modal__footer">
      <button class="btn btn--secondary" @click="handleCancel">Cancel</button>
      <button
        v-if="step === 'ready'"
        class="btn btn--primary"
        :disabled="selection.selectedCount.value === 0"
        @click="startImport"
      >
        Import ({{ selection.selectedCount.value }})
      </button>
      <button v-else-if="step === 'done'" class="btn btn--secondary" @click="handleCancel">
        Done
      </button>
    </div>
  </div>
</template>

<style scoped>
.spotify-picker-modal {
  padding: var(--space-5);
  min-width: 500px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.spotify-picker-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.spotify-picker-modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.spotify-picker-modal__list {
  height: 320px;
  overflow: hidden;
  border-top: 1px solid var(--color-border-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
}

.spotify-picker-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
