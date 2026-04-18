<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import { useListFilter } from '@/composables/useListFilter'
import { useListSelection } from '@/composables/useListSelection'
import { useListSort } from '@/composables/useListSort'
import { useSelectedFirstDisplay } from '@/composables/useSelectedFirstDisplay'
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
const OPERATION_ID = 'spotify-import'
const LOADING_STEP_LABEL = 'Loading Spotify playlists...'

const step = ref<'loading' | 'ready' | 'progress' | 'done' | 'error'>('loading')
const playlists = ref<SpotifyPlaylistSummary[]>([])
const result = ref<ImportResult | null>(null)
const errorMsg = ref<string | null>(null)
const issueMessages = ref<string[]>([])
const statusMsg = ref('')
const progress = ref<number>(-1)
const playlistFetchLoaded = ref(0)
const playlistFetchTotal = ref(0)

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
const { displayItems } = useSelectedFirstDisplay(sorted, selection.selectedIds, (item) => item.id)
const playlistFetchProgress = computed(() => {
  if (playlistFetchTotal.value <= 0) return -1
  return Math.min(playlistFetchLoaded.value / playlistFetchTotal.value, 1)
})

// Extracts Spotify API endpoint from a full URL or path, ensuring it starts with '/v1/' as expected by the spotifyApi instance. 
// This facilitates handling of 'next' URLs from Spotify's paginated responses
function parseSpotifyEndpoint(next: string): string {
  const url = next.startsWith('http') ? new URL(next) : null
  const path = url ? `${url.pathname}${url.search}` : next
  return path.startsWith('/v1/') ? path.slice(3) : path
}

// ----- LOGGING -----
/** Logging helper functions to standardize log messages and make them easier to filter in the console. */

function logInfo(message: string, details?: unknown): void {
  console.info(`[SpotifyPicker] ${message}`, details ?? '')
}

function logWarning(message: string, details?: unknown): void {
  console.warn(`[SpotifyPicker] ${message}`, details ?? '')
}

function logError(message: string, details?: unknown): void {
  console.error(`[SpotifyPicker] ${message}`, details ?? '')
}

function appendIssue(message: string): void {
  issueMessages.value = [...issueMessages.value, message]
}

// normalize playlist data from Spotify API, handling potential missing fields and providing defaults where necessary.
// This ensures that the playlist data used in the component is consistent and complete enough for display and import purposes, while also logging potential issues with the raw data for debugging.
function normalizePlaylistSummary(item: unknown, recordIssues = true): SpotifyPlaylistSummary | null {
  if (!item || typeof item !== 'object') return null
  // Check for required fields and basic structure. 
  const raw = item as Record<string, unknown>
  const candidate = item as Partial<SpotifyPlaylistSummary>

  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
    return null
  }

  // Spotify API may return track count under 'tracks' or 'items' depending on playlist type.
  // Both shapes carry the count as a .total number property.
  const tracksSource = raw['tracks'] ?? raw['items']
  const trackTotal =
    tracksSource !== null &&
    typeof tracksSource === 'object' &&
    typeof (tracksSource as Record<string, unknown>)['total'] === 'number'
      ? ((tracksSource as Record<string, unknown>)['total'] as number)
      : 0

  // Warn on empty playlist, this likely indicates an issue.
  // FUTURE: Decide on proper approach, could exclude to avoid clutter, but may be wanted in some cases
  if (trackTotal === 0 && recordIssues) {
    logWarning('Playlist has zero tracks according to Spotify API', { id: raw['id'], name: raw['name'] })
    appendIssue(`Playlist '${raw['name']}' has zero tracks according to Spotify API`)
  }

  const ownerSource = raw['owner']
  const ownerName =
    ownerSource !== null &&
    typeof ownerSource === 'object' &&
    typeof (ownerSource as Record<string, unknown>)['display_name'] === 'string' &&
    ((ownerSource as Record<string, unknown>)['display_name'] as string).trim().length > 0
      ? ((ownerSource as Record<string, unknown>)['display_name'] as string)
      : 'Unknown owner'

  return {
    id: candidate.id,
    name: candidate.name,
    tracks: { total: trackTotal },
    owner: { display_name: ownerName },
    images: Array.isArray(candidate.images) ? candidate.images : [],
  }
}

function getPlaylistId(item: unknown): string | null {
  return normalizePlaylistSummary(item, false)?.id ?? null
}

function getPlaylistName(item: unknown): string {
  return normalizePlaylistSummary(item, false)?.name ?? 'Unknown playlist'
}

function getPlaylistSubtitle(item: unknown): string {
  const playlist = normalizePlaylistSummary(item, false)
  if (!playlist) return 'Playlist details unavailable'
  return `${playlist.tracks.total} tracks - ${playlist.owner.display_name}`
}

function isPlaylistSelected(item: unknown): boolean {
  const id = getPlaylistId(item)
  return id ? selection.isSelected(id) : false
}

function togglePlaylist(item: unknown): void {
  const id = getPlaylistId(item)
  if (!id) {
    const warning = 'Skipped interaction with a playlist row because its data was incomplete.'
    logWarning(warning, item)
    appendIssue(warning)
    return
  }
  selection.toggle(id)
}

// Fetches the user's Spotify playlists, handling pagination and potential data inconsistencies. 
// Uses helper to normalize playlist data for use in the component, and log any issues encountered during fetching and normalization of data
async function fetchPlaylists(): Promise<void> {
  step.value = 'loading'
  errorMsg.value = null
  issueMessages.value = []
  statusMsg.value = LOADING_STEP_LABEL
  playlistFetchLoaded.value = 0
  playlistFetchTotal.value = 0

  if (!isAuthenticated.value) {
    errorMsg.value = 'Spotify is not connected. Please sign in and try again.'
    logWarning(errorMsg.value)
    step.value = 'error'
    return
  }

  const fetched: SpotifyPlaylistSummary[] = []
  try {
    logInfo('Fetching Spotify playlists')
    let endpoint = '/me/playlists?limit=50'
    let pageCount = 0

    // Loop through paginated results, fetching and normalizing playlist data, and accumulating it in the 'fetched' array.
    // rate throttling is handled by spotifyApi instance, so we can simply loop through pages, awaiting results and trusting the source to manage pacing.
    while (endpoint) {
      pageCount += 1
      const page = await spotifyApi.get<SpotifyPaginatedResponse<SpotifyPlaylistSummary>>(endpoint)
      if (playlistFetchTotal.value === 0) {
        playlistFetchTotal.value = page.total
      }
      playlistFetchLoaded.value = Math.min(playlistFetchLoaded.value + page.items.length, page.total)

      const normalizedItems = page.items
        .map((item) => normalizePlaylistSummary(item))
        .filter((item): item is SpotifyPlaylistSummary => item !== null)

      // report on skipped playlists if tracked
      const skippedCount = page.items.length - normalizedItems.length
      if (skippedCount > 0) {
        const warning = `Skipped ${skippedCount} playlist entr${skippedCount === 1 ? 'y' : 'ies'} with incomplete Spotify data.`
        logWarning(warning, { endpoint, page: pageCount })
        appendIssue(warning)
      }

      // Accumulate normalized playlists and log progress after each page
      fetched.push(...normalizedItems)
      statusMsg.value = playlistFetchTotal.value > 0
        ? `Loaded ${playlistFetchLoaded.value} of ${playlistFetchTotal.value} Spotify playlists...`
        : LOADING_STEP_LABEL
      logInfo('Loaded Spotify playlist page', {
        page: pageCount,
        fetchedRaw: page.items.length,
        fetchedThisPage: normalizedItems.length,
        totalLoaded: fetched.length,
        totalExpected: page.total,
      })
      endpoint = page.next ? parseSpotifyEndpoint(page.next) : ''
    }
    playlists.value = fetched
    statusMsg.value = `Loaded ${fetched.length} Spotify playlists.`
    logInfo('Finished loading Spotify playlists', { totalLoaded: fetched.length })
    step.value = 'ready'
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to fetch playlists'
    statusMsg.value = 'Spotify playlist loading failed.'
    logError(errorMsg.value, err)
    step.value = 'error'
  }
}

/** Initiates the import of the selected Spotify playlists.
// Handles progress updates, potential errors, and logging throughout the process.
*/
async function startImport(): Promise<void> {
  const selected = playlists.value.filter((item) => selection.isSelected(item.id))
  if (selected.length === 0) return

  emit('cancel')
  step.value = 'progress'
  progress.value = -1
  errorMsg.value = null
  issueMessages.value = []
  result.value = null
  statusMsg.value = `Starting Spotify import for ${selected.length} playlist${selected.length !== 1 ? 's' : ''}...`

  activityStore.startOperation(OPERATION_ID, 'Importing from Spotify')
  logInfo('Starting Spotify import', {
    playlistCount: selected.length,
    estimatedTracks: selected.reduce((sum, item) => sum + (item.tracks.total ?? 0), 0),
  })

  // Get and validate the Spotify import adapter
  const spotifyAdapter = getImporter<SpotifyImportOptions>('spotify')
  if (!spotifyAdapter) {
    const message = 'Spotify importer not registered'
    errorMsg.value = message
    statusMsg.value = 'Spotify import setup failed.'
    logError(message)
    step.value = 'error'
    activityStore.failOperation(OPERATION_ID, message)
    return
  }

  // Call the import method of the Spotify adapter, passing the selected playlists and a progress callback to update the UI and activity store.
  try {
    const response = await spotifyAdapter.import(
      { playlists: selected },
      (done, total, label) => {
        progress.value = total > 0 ? done / total : -1
        statusMsg.value = label
          ? `Importing Playlist '${label}' (${done}/${total})`
          : `Importing Playlists (${done}/${total})`
        activityStore.updateProgress(OPERATION_ID, {
          done,
          total,
          phase: 'Importing Spotify',
          itemLabel: label,
        })
      },
    )
    result.value = response
    issueMessages.value = response.errors
    statusMsg.value = `Spotify import complete. Imported ${response.playlistsImported} playlist${response.playlistsImported !== 1 ? 's' : ''} and ${response.tracksImported} track${response.tracksImported !== 1 ? 's' : ''}.`
    if (response.errors.length > 0) {
      logWarning('Spotify import completed with issues', response.errors)
    }
    logInfo('Spotify import complete', response)
    step.value = 'done'
    activityStore.completeOperation(OPERATION_ID)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Spotify import failed'
    errorMsg.value = message
    statusMsg.value = 'Spotify import failed.'
    logError(message, err)
    step.value = 'error'
    activityStore.failOperation(OPERATION_ID, message)
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
  <div class="selection-modal">
    <h2 class="selection-modal__title">Import from Spotify</h2>
    <p v-if="statusMsg && step !== 'ready'" class="selection-modal__status text-muted text-sm">{{ statusMsg }}</p>

    <div v-if="step === 'loading'" class="selection-modal__body">
      <p class="text-muted">Loading playlists…</p>
      <ProgressBar :progress="playlistFetchProgress" />
    </div>

    <div v-else-if="step === 'error'" class="selection-modal__body">
      <p class="io-modal__error">{{ errorMsg }}</p>
      <button class="btn btn--secondary" @click="handleRetry">
        {{ isAuthenticated ? 'Try Again' : 'Connect to Spotify' }}
      </button>
    </div>

    <div v-else-if="step === 'ready'" class="selection-modal__body">
      <ControlBar>
        <SearchBar v-model="query" placeholder="Filter playlists…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />
      </ControlBar>

      <div class="selection-modal__list">
        <ScrollableList :items="displayItems" key-field="id" :estimate-size="56">
          <template #item="{ item }">
            <SelectableItem
              :label="getPlaylistName(item)"
              :subtitle="getPlaylistSubtitle(item)"
              :selected="isPlaylistSelected(item)"
              @toggle="togglePlaylist(item)"
            />
          </template>
          <template #empty>
            <p class="text-muted">No matching playlists</p>
          </template>
        </ScrollableList>
      </div>

      <div v-if="issueMessages.length > 0" class="selection-modal__issues">
        <p class="selection-modal__issues-title">Notable issues</p>
        <ul class="selection-modal__issues-list">
          <li v-for="issue in issueMessages" :key="issue">{{ issue }}</li>
        </ul>
      </div>
    </div>

    <div v-else-if="step === 'progress'" class="selection-modal__body">
      <p class="text-muted">Importing selected playlists…</p>
      <ProgressBar :progress="progress" />
    </div>

    <div v-else-if="step === 'done' && result" class="selection-modal__body">
      <p>
        Imported <strong>{{ result.tracksImported }}</strong> track{{ result.tracksImported !== 1 ? 's' : '' }}
      </p>
      <p v-if="result.playlistsImported > 0">
        and {{ result.playlistsImported }} playlist{{ result.playlistsImported !== 1 ? 's' : '' }}
      </p>
      <p v-if="result.errors.length > 0" class="io-modal__error">
        {{ result.errors.length }} error(s) during import
      </p>
      <div v-if="issueMessages.length > 0" class="selection-modal__issues">
        <p class="selection-modal__issues-title">Import issues</p>
        <ul class="selection-modal__issues-list">
          <li v-for="issue in issueMessages" :key="issue">{{ issue }}</li>
        </ul>
      </div>
    </div>

    <div class="selection-modal__footer">
      <span v-if="step === 'ready' && selection.selectedCount.value > 0" class="text-muted text-sm">
        {{ selection.selectedCount.value }} selected
      </span>
      <div v-else />
      <div class="selection-modal__footer-actions">
        <button class="btn btn--secondary" @click="handleCancel">
          {{ step === 'done' ? 'Done' : 'Cancel' }}
        </button>
        <button
          v-if="step === 'ready'"
          class="btn btn--primary"
          :disabled="selection.selectedCount.value === 0"
          @click="startImport"
        >
          Import ({{ selection.selectedCount.value }})
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
