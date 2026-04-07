<script setup lang="ts">
/**
 * PROTOTYPE A — Import Modal with source-picker step
 * Step 1: Pick source (Local Files vs Spotify)
 * Step 2: Local file picker / progress / summary
 * Spotify step is stubbed.
 *
 * STATUS: UI prototype only — no data layer integration.
 */
import { ref } from 'vue'

type Step = 'source' | 'local-pick' | 'local-progress' | 'local-done'

const emit = defineEmits<{ cancel: [] }>()
const step = ref<Step>('source')

function pickLocal() {
  step.value = 'local-pick'
}

function simulateImport() {
  step.value = 'local-progress'
  setTimeout(() => { step.value = 'local-done' }, 1200)
}

function goBack() {
  step.value = 'source'
}
</script>

<template>
  <div class="proto-modal">
    <!-- Step: Source picker -->
    <template v-if="step === 'source'">
      <h2 class="proto-modal__title">Import Tracks</h2>
      <p class="text-muted text-sm">Choose a source</p>

      <div class="source-picker">
        <button class="source-card" @click="pickLocal">
          <span class="source-card__label">Local Files</span>
          <span class="source-card__hint text-muted text-xs">CSV, JSON</span>
        </button>

        <button class="source-card source-card--disabled" disabled>
          <span class="source-card__label">Spotify</span>
          <!-- <span class="source-card__badge">(Coming soon)</span> -->
          <span class="source-card__hint text-muted text-xs">(Coming soon)</span>

        </button>
      </div>

      <div class="proto-modal__footer">
        <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
      </div>
    </template>

    <!-- Step: Local file picker -->
    <template v-else-if="step === 'local-pick'">
      <div class="proto-modal__header-row">
        <button class="proto-back" @click="goBack">&larr;</button>
        <h2 class="proto-modal__title">Import from Files</h2>
      </div>

      <div class="proto-modal__body">
        <label class="btn btn--secondary">
          Choose Files
          <input type="file" accept=".csv,.json" multiple hidden @change="simulateImport" />
        </label>
        <p class="text-muted text-sm">Supported: CSV, JSON</p>
      </div>

      <div class="proto-modal__footer">
        <button class="btn btn--secondary" @click="goBack">Back</button>
      </div>
    </template>

    <!-- Step: Progress -->
    <template v-else-if="step === 'local-progress'">
      <h2 class="proto-modal__title">Importing…</h2>
      <div class="proto-modal__body">
        <div class="proto-progress-bar">
          <div class="proto-progress-bar__fill proto-progress-bar__fill--indeterminate" />
        </div>
      </div>
    </template>

    <!-- Step: Done -->
    <template v-else-if="step === 'local-done'">
      <h2 class="proto-modal__title">Import Complete</h2>
      <div class="proto-modal__body">
        <p>Imported <strong>42</strong> tracks from <strong>2</strong> playlists</p>
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

/* Source picker */
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
  transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
  color: var(--color-text);
}
.source-card:hover:not(:disabled) {
  border-color: var(--color-accent);
  background: var(--color-surface);
}
.source-card--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.source-card__label {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
}
.source-card__hint { font-size: var(--font-size-xs); }
.source-card__badge {
  font-size: var(--font-size-xs);
  background: var(--gray-600);
  color: var(--gray-300);
  padding: 2px 8px;
  border-radius: var(--radius-full);
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
