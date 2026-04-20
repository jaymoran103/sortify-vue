<script setup lang="ts">
import { ref } from 'vue'
import { getImporter } from '@/adapters/registry'
import { useModal } from '@/composables/useModal'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import { useActivityStore } from '@/stores/activity'
import SpotifyPlaylistPickerModal from './SpotifyPlaylistPickerModal.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import type { ImportResult } from '@/types/adapters'
import ErrorSummary from '@/components/common/ErrorSummary.vue'

const emit = defineEmits<{
  cancel: []
}>()
const activityStore = useActivityStore()
const modal = useModal()
const { isAuthenticated, isLoading, login } = useSpotifyAuth()
const OPERATION_ID = 'file-import'

// TODO HACK: optionally closes modal once import starts
const CLOSE_MODAL_ON_IMPORT = true

type Step = 'source' | 'files' | 'progress' | 'done'

// State variables to track current step of the import process, progress percentage, import results, and any error messages.
const step = ref<Step>('source')
const progress = ref<number>(-1)
const result = ref<ImportResult | null>(null)
const errorMsg = ref<string | null>(null)

function selectLocalFiles(): void {
  step.value = 'files'
}

async function openSpotifyImport(): Promise<void> {
  if (!isAuthenticated.value) {
    await login()
    return
  }
  emit('cancel')
  modal.open(SpotifyPlaylistPickerModal).catch(() => {
    // Ignore modal promise rejections from user cancellation.
  })
}

// Main file handling function: CSVs are batched into one adapter call; each JSON is imported individually.
// Handles UI state for importing process and any errors that occur.
// Results are accumulated across all adapter calls and merged into a single summary.
async function handleFiles(e: Event): Promise<void> {

  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (!files.length) return

  // Filter files by type. TODO: More efficient to iterate through files, adding to respective arrays in a single pass? This seems fine given the small number of file types.
  const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'))
  const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'))
  const unsupported = files.filter(
    (f) => !f.name.toLowerCase().endsWith('.csv') && !f.name.toLowerCase().endsWith('.json'),
  )

  if (unsupported.length > 0 && csvFiles.length === 0 && jsonFiles.length === 0) {
    errorMsg.value = `Unsupported file type(s): ${unsupported.map((f) => f.name).join(', ')}`
    return
  }

  // TODO HACK: optionally closes modal once import starts
  if (CLOSE_MODAL_ON_IMPORT) {
    emit('cancel')
  }
  step.value = 'progress'
  errorMsg.value = null
  progress.value = -1

  // Start tracking in the activity store so IOCard footer shows progress.
  activityStore.startOperation(OPERATION_ID, 'Importing files', 'file-import')

  // Track progress through input files. JSON and CSV files are currently weighted equally - FUTURE: revisit this approach for more accurate progress reporting,
  const accumulated: ImportResult = { tracksImported: 0, playlistsImported: 0, errors: [] }
  const totalUnits = csvFiles.length + jsonFiles.length
  let completedUnits = 0

  // Call adapter's import function for each file type, batching csv and json files.
  try {
    if (csvFiles.length > 0) {

      // Get and validate CSV adapter
      const csvAdapter = getImporter('csv')
      if (!csvAdapter) throw new Error('CSV importer not registered')

      // Call import with all CSV files at once. T
      // he adapter normalises row-level per-file progress to a [0, csvFiles.length] range, so we can divide by totalUnits directly.
      const r = await csvAdapter.import(
        { files: csvFiles },
        //TODO could save some math by providing totalUnits and incrementing a counter from here, but exposing a single figure is more modular and avoids mismatched progress if units change.
        (done, _total, label) => {
          progress.value = done / totalUnits
          activityStore.updateProgress(OPERATION_ID, {
            done: Math.round(done),
            total: totalUnits,
            phase: 'Importing CSV',
            itemLabel: label,
          })
        },
      )

      // Accumulate results from CSV import
      completedUnits += csvFiles.length
      progress.value = completedUnits / totalUnits
      accumulated.tracksImported += r.tracksImported
      accumulated.playlistsImported += r.playlistsImported
      accumulated.errors.push(...r.errors)
    }

    if (jsonFiles.length > 0) {
      // Get and validate JSON adapter
      const jsonAdapter = getImporter('json')
      if (!jsonAdapter) throw new Error('JSON importer not registered')

      // Call import for each JSON file sequentially, reporting per-playlist progress via callback.
      for (const file of jsonFiles) {
        const r = await jsonAdapter.import(
          { file },
          (done, total, label) => {
            activityStore.updateProgress(OPERATION_ID, {
              done,
              total,
              phase: 'Importing JSON',
              itemLabel: label,
            })
          },
        )
        completedUnits += 1
        progress.value = completedUnits / totalUnits
        accumulated.tracksImported += r.tracksImported
        accumulated.playlistsImported += r.playlistsImported
        accumulated.errors.push(...r.errors)
      }
    }

    result.value = accumulated
    step.value = 'done'

    // Forward per-item warnings to the activity store so the IOCard footer shows them.
    for (const msg of accumulated.errors) {
      activityStore.addError(OPERATION_ID, { category: 'warning', message: msg, items: [] })
    }
    activityStore.completeOperation(OPERATION_ID, {
      tracks: accumulated.tracksImported,
      playlists: accumulated.playlistsImported,
      warnings: accumulated.errors.length,
    })
  } catch (err) {
    errorMsg.value = (err as Error).message
    step.value = 'files'
    activityStore.failOperation(OPERATION_ID, (err as Error).message)
  }
}
</script>

<template>
  <div class="io-modal">
    <h2 class="io-modal__title">Import</h2>

    <!-- Step: source picker -->
    <div v-if="step === 'source'" class="io-modal__body">
      <p class="text-muted text-sm">Where are you importing from?</p>
      <div class="source-card-grid">

        <!-- Local Files Option -->
        <button class="source-card" @click="selectLocalFiles">
          <span class="source-card__label">Local Files</span>
          <span class="source-card__hint">CSV or JSON</span>
        </button>

        <!-- Spotify Option: opens the Spotify playlist picker when authenticated. -->
        <button class="source-card" type="button" @click="openSpotifyImport" :disabled="isLoading">
          <span class="source-card__label">Spotify</span>
          <span class="source-card__hint">{{ isAuthenticated ? 'Browse playlists' : 'Sign in to Spotify' }}</span>
        </button>
      </div>
    </div>

    <!-- Step: file picker -->
    <div v-else-if="step === 'files'" class="io-modal__body">
      <label class="btn btn--secondary io-modal__file-label">
        Choose Files
        <input type="file" accept=".csv,.json" multiple hidden @change="handleFiles" />
      </label>
      <p class="text-muted text-sm">Supported formats: CSV, JSON.</p>
      <p v-if="errorMsg" class="io-modal__error">{{ errorMsg }}</p>
    </div>

    <!-- Step: progress -->
    <div v-else-if="step === 'progress'" class="io-modal__body">
      <p class="text-muted">Importing&hellip;</p>
      <ProgressBar :progress="progress" />
    </div>

    <!-- Step: done -->
    <div v-else-if="step === 'done' && result" class="io-modal__body">
      <p>
        Imported <strong>{{ result.tracksImported }}</strong> track{{
          result.tracksImported !== 1 ? 's' : ''
        }}
      </p>
      <p v-if="result.playlistsImported > 0">
        and {{ result.playlistsImported }} playlist{{
          result.playlistsImported !== 1 ? 's' : ''
        }}
      </p>
      <p v-if="result.errors.length > 0">
        {{ result.errors.length }} issue{{ result.errors.length !== 1 ? 's' : '' }} during import:
      </p>
      <ErrorSummary
        v-if="result.errors.length > 0"
        :errors="result.errors.map((msg) => ({ category: 'warning', message: msg, items: [] }))"
      />
    </div>

    <div class="io-modal__footer">
      <button v-if="step !== 'source' && step !== 'done'" class="btn btn--ghost" @click="step = 'source'">
        Back
      </button>
      <button class="btn btn--secondary" @click="emit('cancel')">
        {{ step === 'done' ? 'Done' : 'Cancel' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.io-modal__file-label {
  cursor: pointer;
  align-self: flex-start;
}
</style>
