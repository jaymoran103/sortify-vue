<script setup lang="ts">
import { ref } from 'vue'
import { getImporter } from '@/adapters/registry'
import type { ImportResult } from '@/types/adapters'

const emit = defineEmits<{
  cancel: []
}>()

const isImporting = ref(false)
const progress = ref<number>(-1)
const result = ref<ImportResult | null>(null)
const errorMsg = ref<string | null>(null)

// Main file handling function: determines adapter based on file extension, then calls import function with appropriate parameters and progress callback.
// Handles UI state for importing process and any errors that occur.
async function handleFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase()
  // TODO syntax could be nicer here.
  const adapterKey = ext === 'csv' ? 'csv' : ext === 'json' ? 'json' : null

  // exit early for bad file types
  if (!adapterKey) {
    errorMsg.value = `Unsupported file type: .${ext ?? 'unknown'}`
    return
  }

  const adapter = getImporter(adapterKey)
  if (!adapter) {
    errorMsg.value = `No importer found for .${ext}`
    return
  }

  // Update UI state to reflect importing process
  isImporting.value = true
  errorMsg.value = null
  progress.value = -1

  // Call adapter's import function with file and progress callback.  
  // Adapter handles parsing and importing logic, while this component manages UI state and error handling.
  try {
    const importResult = await adapter.import(
      // FUTURE: Decouple from csv specifics if more formats added.  Fine for now
      adapterKey === 'csv' ? { files: [file] } : { file },
      (done, total) => {
        progress.value = total > 0 ? done / total : -1
      },
    )
    result.value = importResult
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
        Choose File
        <input type="file" accept=".csv,.json" hidden @change="handleFile" />
      </label>
      <p class="text-muted import-modal__hint">Supported formats: CSV, JSON</p>
      <p v-if="errorMsg" class="import-modal__error">{{ errorMsg }}</p>
    </div>

    <div v-else-if="isImporting" class="import-modal__body">
      <p class="text-muted">Importing&hellip;</p>
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
