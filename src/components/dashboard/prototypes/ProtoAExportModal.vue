<script setup lang="ts">
/**
 * PROTOTYPE A — Export Modal with stepped flow
 * Step 1: Pick destination (Local Files vs Spotify)
 * Step 2: Playlist selection (inline checkboxes)
 * Step 3: Format/profile options
 * Step 4: Done
 *
 * STATUS: UI prototype only — no data layer integration.
 */
import { ref, computed } from 'vue'

type Step = 'dest' | 'playlists' | 'options' | 'exporting' | 'done'

const emit = defineEmits<{ cancel: [] }>()
const step = ref<Step>('dest')

// Mock playlist data
const mockPlaylists = [
  { id: 1, name: 'Morning Mix', tracks: 34 },
  { id: 2, name: 'Late Night', tracks: 52 },
  { id: 3, name: 'Workout', tracks: 18 },
  { id: 4, name: 'Focus Time', tracks: 41 },
]

const selectedIds = ref<Set<number>>(new Set())
const allSelected = computed(() => selectedIds.value.size === mockPlaylists.length)
const format = ref('csv')
const profile = ref('full')

function togglePlaylist(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(mockPlaylists.map((p) => p.id))
  }
}

function pickLocal() { step.value = 'playlists' }
function goToOptions() { step.value = 'options' }
function simulateExport() {
  step.value = 'exporting'
  setTimeout(() => { step.value = 'done' }, 1000)
}
function goBack(target: Step) { step.value = target }
</script>

<template>
  <div class="proto-modal">
    <!-- Step: Destination picker -->
    <template v-if="step === 'dest'">
      <h2 class="proto-modal__title">Export Tracks</h2>
      <p class="text-muted text-sm">Choose a destination</p>

      <div class="source-picker">
        <button class="source-card" @click="pickLocal">
          <span class="source-card__label">Local Files</span>
          <span class="source-card__hint text-muted text-xs">CSV, JSON</span>
        </button>

        <button class="source-card source-card--disabled" disabled>
          <span class="source-card__label">Spotify</span>
          <!-- <span class="source-card__badge">Coming soon</span> -->
          <span class="source-card__hint text-muted text-xs">(Coming soon)</span>

        </button>
      </div>

      <div class="proto-modal__footer">
        <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
      </div>
    </template>

    <!-- Step: Playlist selection -->
    <template v-else-if="step === 'playlists'">
      <div class="proto-modal__header-row">
        <button class="proto-back" @click="goBack('dest')">&larr;</button>
        <h2 class="proto-modal__title">Select Playlists</h2>
      </div>

      <div class="playlist-select-list">
        <label class="playlist-row playlist-row--all">
          <input type="checkbox" :checked="allSelected" @change="toggleAll" />
          <span>Select all</span>
        </label>
        <label v-for="pl in mockPlaylists" :key="pl.id" class="playlist-row">
          <input type="checkbox" :checked="selectedIds.has(pl.id)" @change="togglePlaylist(pl.id)" />
          <span>{{ pl.name }}</span>
          <span class="text-muted text-xs">{{ pl.tracks }} tracks</span>
        </label>
      </div>

      <div class="proto-modal__footer">
        <button class="btn btn--secondary" @click="goBack('dest')">Back</button>
        <button class="btn btn--primary" :disabled="selectedIds.size === 0" @click="goToOptions">
          Next ({{ selectedIds.size }})
        </button>
      </div>
    </template>

    <!-- Step: Format / profile options -->
    <template v-else-if="step === 'options'">
      <div class="proto-modal__header-row">
        <button class="proto-back" @click="goBack('playlists')">&larr;</button>
        <h2 class="proto-modal__title">Export Options</h2>
      </div>

      <div class="proto-modal__body">
        <div class="proto-field">
          <label class="proto-field__label text-muted text-sm">Format</label>
          <select v-model="format" class="sort-dropdown">
            <option value="csv">CSV File</option>
            <option value="json">JSON Bundle</option>
          </select>
        </div>
        <div v-if="format === 'csv'" class="proto-field">
          <label class="proto-field__label text-muted text-sm">Profile</label>
          <select v-model="profile" class="sort-dropdown">
            <option value="full">Full (all fields)</option>
            <option value="minimal">Minimal (title, artist, album)</option>
          </select>
        </div>
        <p class="text-muted text-xs">{{ selectedIds.size }} playlist(s) selected</p>
      </div>

      <div class="proto-modal__footer">
        <button class="btn btn--secondary" @click="goBack('playlists')">Back</button>
        <button class="btn btn--primary" @click="simulateExport">Export</button>
      </div>
    </template>

    <!-- Step: Exporting -->
    <template v-else-if="step === 'exporting'">
      <h2 class="proto-modal__title">Exporting…</h2>
      <div class="proto-modal__body">
        <div class="proto-progress-bar">
          <div class="proto-progress-bar__fill proto-progress-bar__fill--indeterminate" />
        </div>
      </div>
    </template>

    <!-- Step: Done -->
    <template v-else-if="step === 'done'">
      <h2 class="proto-modal__title">Export Complete</h2>
      <div class="proto-modal__body">
        <p>Exported {{ selectedIds.size }} playlist(s). Check your downloads folder.</p>
      </div>
      <div class="proto-modal__footer">
        <button class="btn btn--secondary" @click="emit('cancel')">Done</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.proto-modal {
  padding: var(--space-5);
  min-width: 380px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.proto-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}
.proto-modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.proto-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.proto-modal__header-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Source picker (shared with import) */
.source-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.source-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default),
              background var(--duration-fast) var(--ease-default);
  color: var(--color-text);
}
.source-card:hover:not(:disabled) {
  border-color: var(--color-accent);
  background: var(--color-surface);
}
.source-card--disabled { opacity: 0.5; cursor: not-allowed; }
.source-card__label { font-weight: var(--font-weight-medium); font-size: var(--font-size-sm); }
.source-card__hint { font-size: var(--font-size-xs); }
.source-card__badge {
  font-size: var(--font-size-xs);
  background: var(--gray-600);
  color: var(--gray-300);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

/* Playlist selection */
.playlist-select-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 220px;
  overflow-y: auto;
}
.playlist-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}
.playlist-row:hover {
  background: var(--color-row-hover);
}
.playlist-row--all {
  font-weight: var(--font-weight-medium);
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: var(--space-2);
  margin-bottom: var(--space-1);
}
.playlist-row input[type="checkbox"] {
  accent-color: var(--color-accent);
}

/* Fields */
.proto-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Sort-dropdown styling (matches SortDropdown.vue) */
.sort-dropdown {
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

/* Back button */
.proto-back {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  cursor: pointer;
  padding: var(--space-1);
}
.proto-back:hover { color: var(--color-text); }

/* Progress bar mock */
.proto-progress-bar {
  height: 4px;
  background: var(--color-surface-raised);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.proto-progress-bar__fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
}
.proto-progress-bar__fill--indeterminate {
  width: 40%;
  animation: proto-shimmer 1.2s ease-in-out infinite;
}
@keyframes proto-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
</style>
