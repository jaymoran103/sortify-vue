<script setup lang="ts">
import { ref } from 'vue'
import { getImporter } from '@/adapters/registry'
import ProgressBar from '@/components/common/ProgressBar.vue'
import type { ImportResult } from '@/types/adapters'

const emit = defineEmits<{
  cancel: []
}>()

const isImporting = ref(false)
const progress = ref<number>(-1)
const result = ref<ImportResult | null>(null)
const errorMsg = ref<string | null>(null)

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

  isImporting.value = true
  errorMsg.value = null
  progress.value = -1

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
        (done) => { progress.value = done / totalUnits },
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

      // Call import for each JSON file sequentially, accumulating results.
      // TODO: Settle on better progress approach with JSON imports — currently each file is one unit regardless of size.
      for (const file of jsonFiles) {
        const r = await jsonAdapter.import({ file })
        completedUnits += 1
        progress.value = completedUnits / totalUnits
        accumulated.tracksImported += r.tracksImported
        accumulated.playlistsImported += r.playlistsImported
        accumulated.errors.push(...r.errors)
      }
    }

    result.value = accumulated
  } catch (err) {
    errorMsg.value = (err as Error).message
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <div class="import-modal">
    <h2 class="import-modal__title">Import Tracks</h2>

    <div v-if="!isImporting && !result" class="import-modal__body">
      <label class="btn btn--secondary import-modal__file-label">
        Choose Files
        <input type="file" accept=".csv,.json" multiple hidden @change="handleFiles" />
      </label>
      <p class="text-muted import-modal__hint">Supported formats: CSV, JSON.</p>
      <p v-if="errorMsg" class="import-modal__error">{{ errorMsg }}</p>
    </div>

    <div v-else-if="isImporting" class="import-modal__body">
      <p class="text-muted">Importing&hellip;</p>
      <ProgressBar :progress="progress" />
    </div>

    <div v-else-if="result" class="import-modal__body">
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
      <p v-if="result.errors.length > 0" class="import-modal__error">
        {{ result.errors.length }} error(s) during import
      </p>
    </div>

    <div class="import-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">
        {{ result ? 'Done' : 'Cancel' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.import-modal {
  padding: var(--space-5);
  min-width: 360px;
}

.import-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-4);
}

.import-modal__body {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.import-modal__hint {
  font-size: var(--font-size-sm);
}

.import-modal__error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.import-modal__footer {
  display: flex;
  justify-content: flex-end;
}

.import-modal__file-label {
  cursor: pointer;
  align-self: flex-start;
}
</style>
