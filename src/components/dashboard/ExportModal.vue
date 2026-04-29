<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getExporter } from '@/adapters/registry'
import { usePlaylistStore } from '@/stores/playlists'
import { useActivityStore } from '@/stores/activity'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import { PENDING_ACTIONS } from '@/spotify/pendingIntent'
import type { SpotifyExportOptions } from '@/adapters/spotifyExport'
import { useListFilter } from '@/composables/useListFilter'
import { useListSelection } from '@/composables/useListSelection'
import { useListSort } from '@/composables/useListSort'
import { useSelectedFirstDisplay } from '@/composables/useSelectedFirstDisplay'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ScrollableList from '@/components/common/ScrollableList.vue'
import SelectableItem from '@/components/common/SelectableItem.vue'
import type { Playlist } from '@/types/models'
import type { SortOption } from '@/types/ui'

type Step = 'source' | 'playlists' | 'options'

const props = withDefaults(defineProps<{ autoSpotify?: boolean }>(), { autoSpotify: false })

const emit = defineEmits<{
  cancel: []
}>()

const activityStore = useActivityStore()
const { isAuthenticated, login } = useSpotifyAuth()
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
// Display selected items first in the list, while maintaining sort order within selected and unselected groups.
const { displayItems } = useSelectedFirstDisplay(
  sorted,
  selection.selectedIds,
  (item) => String(item.id!),
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
    login(PENDING_ACTIONS.OPEN_SPOTIFY_EXPORTER)
    return
  }
  destination.value = 'spotify'
  step.value = 'playlists'
}

// When opened after an OAuth redirect with autoSpotify:true, skip source picker and go straight to Spotify playlists.
onMounted(() => {
  if (props.autoSpotify) {
    selectSpotify()
  }
})

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

  const adapter = getExporter<SpotifyExportOptions>('spotify')
  if (!adapter) throw new Error('Spotify exporter not registered')

  // Close modal immediately; progress and result display delegate to ActivityIndicator / IOSummaryCard.
  emit('cancel')

  // Unique ID per invocation so each operation gets its own history row.
  const operationId = crypto.randomUUID()
  activityStore.startOperation(operationId, 'Exporting to Spotify', 'spotify-export')

  try {
    const result = await adapter.export(
      { playlistIds: ids },
      (done, total, label) => {
        activityStore.updateProgress(operationId, {
          done,
          total,
          phase: 'Exporting to Spotify',
          itemLabel: label,
        })
      },
    )
    // Forward per-item warnings to the activity store.
    for (const msg of result.errors) {
      activityStore.addError(operationId, { category: 'warning', message: msg, items: [] })
    }
    activityStore.completeOperation(operationId, {
      playlists: result.playlistsExported,
      warnings: result.errors.length,
      linkItems: result.createdPlaylists?.map((p) => ({
        label: p.name,
        href: `https://open.spotify.com/playlist/${p.spotifyId}`,
      })) ?? [],
    })
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Spotify export failed'
    const isRateLimit = rawMsg.startsWith('Rate limited')
    const userMsg = isRateLimit
      ? 'Spotify rate limit reached. Please wait a few minutes before retrying.'
      : rawMsg
    activityStore.failOperation(operationId, userMsg, isRateLimit ? 'rate-limit' : 'error')
  }
}

async function handleExport(): Promise<void> {
  const adapter = getExporter(format.value)
  if (!adapter) {
    errorMsg.value = `No exporter found for ${format.value}`
    return
  }

  errorMsg.value = null

  // Close modal immediately; progress and result display delegate to ActivityIndicator / IOSummaryCard.
  emit('cancel')

  // Unique ID per invocation so each operation gets its own history row.
  const operationId = crypto.randomUUID()
  activityStore.startOperation(operationId, 'Exporting to file', 'file-export')

  try {
    const ids = [...selection.selectedIds.value].map(Number)
    const playlistIds = ids.length > 0 ? ids : 'all'

    if (format.value === 'csv') {
      await adapter.export({ playlistIds, profile: profile.value as 'full' | 'minimal' })
    } else {
      await adapter.export({ playlistIds })
    }
    activityStore.completeOperation(operationId, {
      playlists: ids.length > 0 ? ids.length : (playlistStore.playlists?.length ?? 0),
    })
  } catch (err) {
    activityStore.failOperation(operationId, (err as Error).message)
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
      <div class="selection-modal__controls">
        <SearchBar v-model="query" placeholder="Filter playlists…" />
        <SelectDropdown v-model="currentSort" :options="sortOptions" />
      </div>
      <div class="selection-modal__list selection-modal__list--compact">
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

    <!-- Footer: playlists step has select-all on left + nav on right -->
    <div v-if="step === 'playlists'" class="selection-modal__footer">
      <button class="btn btn--ghost io-modal__select-all" @click="toggleSelectAll">
        {{ allSelected ? 'Deselect All' : 'Select All' }}
      </button>
      <div class="selection-modal__footer-actions">
        <button class="btn btn--ghost" @click="step = 'source'">Back</button>
        <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
        <button
          class="btn btn--primary"
          :disabled="selection.selectedIds.value.size === 0"
          @click="confirmPlaylists"
        >
          Next ({{ selection.selectedCount.value }})
        </button>
      </div>
    </div>

    <!-- Footer: all other steps -->
    <div v-else class="io-modal__footer">
      <button v-if="step === 'options'" class="btn btn--ghost" @click="step = 'playlists'">
        Back
      </button>
      <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
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

.selection-modal__list--compact {
  height: 220px;
}
</style>
