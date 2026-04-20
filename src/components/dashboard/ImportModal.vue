<script setup lang="ts">
import { ref } from 'vue'
import { getImporter } from '@/adapters/registry'
import { useModal } from '@/composables/useModal'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import { useActivityStore } from '@/stores/activity'
import SpotifyPlaylistPickerModal from './SpotifyPlaylistPickerModal.vue'
import type { ImportResult } from '@/types/adapters'

const emit = defineEmits<{
  cancel: []
}>()
const activityStore = useActivityStore()
const modal = useModal()
const { isAuthenticated, isLoading, login } = useSpotifyAuth()
const OPERATION_ID = 'file-import'

type Step = 'source' | 'files'

// Step tracks only the pre-import navigation. After files are chosen, the modal closes.
const step = ref<Step>('source')
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

  // Filter files by type.
  const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'))
  const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'))
  const unsupported = files.filter(
    (f) => !f.name.toLowerCase().endsWith('.csv') && !f.name.toLowerCase().endsWith('.json'),
  )

  if (unsupported.length > 0 && csvFiles.length === 0 && jsonFiles.length === 0) {
    errorMsg.value = `Unsupported file type(s): ${unsupported.map((f) => f.name).join(', ')}`
    return
  }

  // Close modal immediately. Progress and result display delegate to ActivityIndicator / IOSummaryCard.
  emit('cancel')
  errorMsg.value = null

  // Start tracking in the activity store so IOCard footer shows progress.
  activityStore.startOperation(OPERATION_ID, 'Importing files', 'file-import')

  // Track progress through input files. JSON and CSV files are currently weighted equally.
  const accumulated: ImportResult = { tracksImported: 0, playlistsImported: 0, errors: [] }
  const totalUnits = csvFiles.length + jsonFiles.length

  try {
    if (csvFiles.length > 0) {
      const csvAdapter = getImporter('csv')
      if (!csvAdapter) throw new Error('CSV importer not registered')

      const r = await csvAdapter.import(
        { files: csvFiles },
        (done, _total, label) => {
          activityStore.updateProgress(OPERATION_ID, {
            done: Math.round(done),
            total: totalUnits,
            phase: 'Importing CSV',
            itemLabel: label,
          })
        },
      )

      accumulated.tracksImported += r.tracksImported
      accumulated.playlistsImported += r.playlistsImported
      accumulated.errors.push(...r.errors)
    }

    if (jsonFiles.length > 0) {
      const jsonAdapter = getImporter('json')
      if (!jsonAdapter) throw new Error('JSON importer not registered')

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
        accumulated.tracksImported += r.tracksImported
        accumulated.playlistsImported += r.playlistsImported
        accumulated.errors.push(...r.errors)
      }
    }

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

    <div class="io-modal__footer">
      <button v-if="step === 'files'" class="btn btn--ghost" @click="step = 'source'">
        Back
      </button>
      <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.io-modal__file-label {
  cursor: pointer;
  align-self: flex-start;
}
</style>
