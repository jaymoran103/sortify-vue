<script setup lang="ts">
import { computed, ref } from 'vue'
import { getExporter } from '@/adapters/registry'
import SortDropdown from '@/components/common/SortDropdown.vue'

const emit = defineEmits<{
  cancel: []
}>()

const formatOptions = [
  { key: 'csv', label: 'CSV File' },
  { key: 'json', label: 'JSON Bundle' },
]

const profileOptions = [
  { key: 'full', label: 'Full (all fields)' },
  { key: 'minimal', label: 'Minimal (title, artist, album)' },
]

const format = ref('csv')
const profile = ref('full')
const isExporting = ref(false)
const errorMsg = ref<string | null>(null)
const done = ref(false)

const showProfile = computed(() => format.value === 'csv')

// Main export function: calls the appropriate adapter based on selected format and profile, and handles UI state for exporting process
async function handleExport(): Promise<void> {

  // Get appropriate adapter based on selected format.
  const adapter = getExporter(format.value)
  if (!adapter) {
    errorMsg.value = `No exporter found for ${format.value}`
    return
  }

  isExporting.value = true
  errorMsg.value = null

  try {
    // CSV case: pass profile option to control which fields are included in the export.
    if (format.value === 'csv') {
      await adapter.export({ playlistIds: 'all', profile: profile.value as 'full' | 'minimal' })
    } 
    // JSON case: all fields exported, profile option isn't needed
    else {
      await adapter.export({})
    }
    done.value = true
  } catch (err) {
    errorMsg.value = (err as Error).message
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="export-modal">
    <h2 class="export-modal__title">Export Tracks</h2>

    <div v-if="!done" class="export-modal__body">

      <!-- Format selection: always showm -->
      <div class="export-modal__field">
        <label class="export-modal__label">Format</label>
        <SortDropdown v-model="format" :options="formatOptions" />
      </div>

      <!-- Profile selection: only shown for CSV format.  -->
      <!-- FUTURE: Consider a more user-friendly name -->
      <div v-if="showProfile" class="export-modal__field">
        <label class="export-modal__label">Profile</label>
        <SortDropdown v-model="profile" :options="profileOptions" />
      </div>

      <p v-if="errorMsg" class="export-modal__error">{{ errorMsg }}</p>
    </div>

    <div v-else class="export-modal__body">
      <p>Export complete. Check your downloads folder.</p>  <!-- FUTURE: maybe only mention downloads if browser doesn't support directory selection -->
    </div>

    <div class="export-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">
        {{ done ? 'Done' : 'Cancel' }}
      </button>
      <button
        v-if="!done"
        class="btn btn--primary"
        :disabled="isExporting"
        @click="handleExport"
      >
        {{ isExporting ? 'Exporting…' : 'Export' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.export-modal {
  padding: var(--space-5);
  min-width: 360px;
}

.export-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-4);
}

.export-modal__body {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.export-modal__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.export-modal__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.export-modal__error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.export-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
