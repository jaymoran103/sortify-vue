<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { getExporter } from '@/adapters/registry'
import { usePlaylistStore } from '@/stores/playlists'
import { useActivityStore } from '@/stores/activity'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import type { SpotifyExportOptions } from '@/adapters/spotifyExport'
import ErrorSummary from '@/components/common/ErrorSummary.vue'
import { useListFilter } from '@/composables/useListFilter'
import { useListSelection } from '@/composables/useListSelection'
import { useListSort } from '@/composables/useListSort'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem from '@/components/common/SelectableItem.vue'
import type { Playlist } from '@/types/models'
import type { SortOption } from '@/types/ui'

type Step = 'source' | 'playlists' | 'options' | 'progress' | 'done'

const emit = defineEmits<{
  cancel: []
}>()

const activityStore = useActivityStore()
const { isAuthenticated, login } = useSpotifyAuth()
const SPOTIFY_EXPORT_OPERATION_ID = 'spotify-export'

// ── Format / profile ─────────────────────────────────────────────────────────

const formatOptions = [
  { key: 'csv', label: 'CSV File' },
  { key: 'json', label: 'JSON Bundle' },
]

const profileOptions = [
  { key: 'full', label: 'Full (all fields)' },
  { key: 'minimal', label: 'Minimal (title, artist, album)' },
]

const step = ref<Step>('source')
const destination = ref<'local' | 'spotify'>('local')
const format = ref('csv')
const profile = ref('full')
const errorMsg = ref<string | null>(null)
const spotifyExportResult = ref<{ playlistsExported: number; errors: string[]; createdPlaylists?: Array<{name: string; spotifyId: string}> } | null>(null)

// Profile is only relevant for CSV export, disable it and reset to 'full' when format is JSON
const enableProfile = computed(() => format.value !== 'json')

watch(enableProfile, (enabled) => {
  if (!enabled) {
    profile.value = 'full'
  }
})

// ── Playlist selection (inline, mirrors PlaylistSelectModal) ──────────────────
// FUTURE: Extract selection body into a shared component to avoid drift between the modals?

const playlistStore = usePlaylistStore()
const allPlaylists = computed((): Playlist[] => playlistStore.playlists ?? [])

const sortOptions: SortOption<Playlist>[] = [
  { key: 'name', label: 'Name', compareFn: (a, b) => a.name.localeCompare(b.name) },
  { key: 'trackCount', label: 'Track Count', compareFn: (a, b) => b.trackIDs.length - a.trackIDs.length },
]

const { query, filtered } = useListFilter<Playlist>(
  allPlaylists,
  (item, q) => item.name.toLowerCase().includes(q.toLowerCase()),
)
const { currentSort, sorted } = useListSort<Playlist>(filtered, sortOptions)
const selection = useListSelection<Playlist>(
  sorted,
  (item) => String(item.id!),
  { selectMultiple: true },
  allPlaylists,
)

const displayItems = shallowRef<Playlist[]>([])
watch(
  sorted,
  (newSorted) => {
    const ids = selection.selectedIds.value
    displayItems.value = [...newSorted].sort((a, b) => {
      return (ids.has(String(a.id!)) ? 0 : 1) - (ids.has(String(b.id!)) ? 0 : 1)
    })
  },
  { immediate: true },
)

const allSelected = computed(
  () =>
    sorted.value.length > 0 &&
    sorted.value.every((item) => selection.isSelected(String(item.id!))),
)

function toggleSelectAll(): void {
  if (allSelected.value) selection.clear()
  else selection.selectAll()
}

// ── Step navigation ───────────────────────────────────────────────────────────

function selectLocalFiles(): void {
  destination.value = 'local'
  step.value = 'playlists'
}

function selectSpotify(): void {
  if (!isAuthenticated.value) {
    login()
    return
  }
  destination.value = 'spotify'
  step.value = 'playlists'
}

function confirmPlaylists(): void {
  if (destination.value === 'spotify') {
    void handleSpotifyExport()
  } else {
    step.value = 'options'
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

// Main export function for Spotify: 
// - calls the Spotify export adapter with the selected playlist IDs, 
// - updates activity status based on progress and result. 
// - display caught errors to the user, log in the activity store.
async function handleSpotifyExport(): Promise<void> {
  const ids = [...selection.selectedIds.value].map(Number)
  if (ids.length === 0) return

  step.value = 'progress'
  errorMsg.value = null
  spotifyExportResult.value = null

  // Get the Spotify export adapter, validate
  const adapter = getExporter<SpotifyExportOptions>('spotify')
  if (!adapter) {
    errorMsg.value = 'Spotify exporter not registered'
    step.value = 'playlists'
    return
  }

  // Start tracking in the activity store
  activityStore.startOperation(SPOTIFY_EXPORT_OPERATION_ID, 'Exporting to Spotify')

  // Call adapter export function with progress callback that updates the activity store. 
  // Adapter handles batching and progress reporting internally, this section just needs to pass the callback and update UI state once done or on error.
  try {
    const result = await adapter.export(
      { playlistIds: ids },
      (done, total, label) => {
        activityStore.updateProgress(SPOTIFY_EXPORT_OPERATION_ID, {
          done,
          total,
          phase: 'Exporting to Spotify',
          itemLabel: label,
        })
      },
    )
    spotifyExportResult.value = result
    // Forward per-item warnings (skipped playlists etc.) to the activity store
    // so they appear in the IOCard footer issues list.
    for (const msg of result.errors) {
      activityStore.addError(SPOTIFY_EXPORT_OPERATION_ID, { category: 'warning', message: msg, items: [] })
    }
    step.value = 'done'
    activityStore.completeOperation(SPOTIFY_EXPORT_OPERATION_ID)
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Spotify export failed'
    const isRateLimit = rawMsg.startsWith('Rate limited')
    errorMsg.value = isRateLimit
      ? 'Spotify rate limit reached. Please wait a few minutes before retrying.'
      : rawMsg
    step.value = 'playlists'
    activityStore.failOperation(SPOTIFY_EXPORT_OPERATION_ID, errorMsg.value, isRateLimit ? 'rate-limit' : 'error')
  }
}

async function handleExport(): Promise<void> {
  const adapter = getExporter(format.value)
  if (!adapter) {
    errorMsg.value = `No exporter found for ${format.value}`
    return
  }

  step.value = 'progress'
  errorMsg.value = null

  try {
    const ids = [...selection.selectedIds.value].map(Number)
    const playlistIds = ids.length > 0 ? ids : 'all'

    if (format.value === 'csv') {
      await adapter.export({ playlistIds, profile: profile.value as 'full' | 'minimal' })
    } else {
      await adapter.export({})
    }
    step.value = 'done'
  } catch (err) {
    errorMsg.value = (err as Error).message
    step.value = 'options'
  }
}
</script>

<template>
  <div class="io-modal">
    <h2 class="io-modal__title">Export</h2>

    <!-- Step: source picker -->
    <div v-if="step === 'source'" class="io-modal__body">
      <p class="text-muted text-sm">Where are you exporting to?</p>
      <div class="source-card-grid">
        <button class="source-card" @click="selectLocalFiles">
          <span class="source-card__label">Local Files</span>
          <span class="source-card__hint">CSV or JSON</span>
        </button>
        <button class="source-card" @click="selectSpotify">
          <span class="source-card__label">Spotify</span>
          <span class="source-card__hint">{{ isAuthenticated ? 'Export playlists' : 'Connect to Spotify' }}</span>
        </button>
      </div>
    </div>

    <!-- Step: playlist selection -->
    <div v-else-if="step === 'playlists'" class="io-modal__body io-modal__body--playlists">
      <div class="io-modal__list-controls">
        <SearchBar v-model="query" placeholder="Filter playlists…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />
      </div>
      <div class="io-modal__list">
        <ScrollableList :items="displayItems" key-field="id" :estimate-size="48">
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

    <!-- Step: format/profile options -->
    <div v-else-if="step === 'options'" class="io-modal__body">
      <div class="io-modal__field">
        <label class="io-modal__label">Format</label>
        <SelectDropdown v-model="format" :options="formatOptions" />
      </div>
      <div class="io-modal__field">
        <label class="io-modal__label">Profile</label>
        <SelectDropdown v-model="profile" 
          :options="profileOptions" 
          :disabled="!enableProfile" 
          :title="!enableProfile ? 'JSON Bundles include all fields' : ''" 
        />   
        <!-- NOTE: tooltip assumes selection of JSON Bundle is responsible for disabling this dropdown -->  
      </div>
      <p v-if="errorMsg" class="io-modal__error">{{ errorMsg }}</p>
    </div>

    <!-- Step: progress -->
    <div v-else-if="step === 'progress'" class="io-modal__body">
      <p class="text-muted">Exporting&hellip;</p>
    </div>

    <!-- Step: done -->
    <div v-else-if="step === 'done'" class="io-modal__body">
      <!-- Separate handling for Spotify export results vs local file export -->
      <template v-if="destination === 'spotify' && spotifyExportResult">
        <p>
          Exported <strong>{{ spotifyExportResult.playlistsExported }}</strong>
          playlist{{ spotifyExportResult.playlistsExported !== 1 ? 's' : '' }} to Spotify.
        </p>
        <!-- For exports with successfully created playlists, display each one as a link TODO: Review-->
        <ul v-if="spotifyExportResult.createdPlaylists?.length" class="export-modal__spotify-links">
          <li v-for="pl in spotifyExportResult.createdPlaylists" :key="pl.spotifyId">
            <a
              :href="`https://open.spotify.com/playlist/${pl.spotifyId}`"
              target="_blank"
              rel="noopener noreferrer"
            >{{ pl.name }}</a>
          </li>
        </ul>
        <!-- For exports with errors, display via ErrorSummary -->
        <ErrorSummary
          v-if="spotifyExportResult.errors.length > 0"
          :errors="spotifyExportResult.errors.map((msg) => ({ category: 'warning', message: msg, items: [] }))"
        />
      </template>
      <template v-else>
        <p>Export complete. Check your downloads folder.</p>
      </template>
    </div>

    <!-- Footer: playlists step has select-all on left + nav on right -->
    <div v-if="step === 'playlists'" class="io-modal__footer">
      <button class="btn btn--ghost io-modal__select-all" @click="toggleSelectAll">
        {{ allSelected ? 'Deselect All' : 'Select All' }}
      </button>
      <button class="btn btn--ghost" @click="step = 'source'">Back</button>
      <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
      <button
        class="btn btn--primary"
        :disabled="selection.selectedIds.value.size === 0"
        @click="confirmPlaylists"
      >
        {{ destination === 'spotify' ? `Export (${selection.selectedCount.value})` : `Next (${selection.selectedCount.value})` }}
      </button>
    </div>

    <!-- Footer: all other steps -->
    <div v-else class="io-modal__footer">
      <button v-if="step === 'options'" class="btn btn--ghost" @click="step = 'playlists'">
        Back
      </button>
      <button class="btn btn--secondary" @click="emit('cancel')">
        {{ step === 'done' ? 'Done' : 'Cancel' }}
      </button>
      <button v-if="step === 'options'" class="btn btn--primary" @click="handleExport">
        Export
      </button>
    </div>
  </div>
</template>

<style scoped>
.io-modal__body--playlists {
  min-height: 280px;
}

.io-modal__list-controls {
  display: flex;
  gap: var(--space-2);
}

.io-modal__list {
  min-height: 0;
  height: 220px;
  overflow: hidden;
  border-top: 1px solid var(--color-border-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
}

.export-modal__spotify-links {
  margin: 0;
  padding-left: var(--space-4);
  font-size: var(--font-size-sm);
}

.export-modal__spotify-links a {
  color: var(--color-accent);
}

.io-modal__select-all {
  margin-right: auto;
}
</style>
