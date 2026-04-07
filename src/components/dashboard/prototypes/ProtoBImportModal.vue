<script setup lang="ts">
/**
 * PROTOTYPE B — Import Modal with tab bar
 * Tabs: Files (active) | Spotify (disabled)
 * Files tab: file picker + mock progress + mock summary
 *
 * STATUS: UI prototype only.
 */
import { ref } from 'vue'

const emit = defineEmits<{ cancel: [] }>()
const tab = ref<'files' | 'spotify'>('files')
const phase = ref<'pick' | 'progress' | 'done'>('pick')

function simulateImport() {
  phase.value = 'progress'
  setTimeout(() => { phase.value = 'done' }, 1200)
}
</script>

<template>
  <div class="proto-modal">
    <h2 class="proto-modal__title">Import Tracks</h2>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button class="tab-bar__tab" :class="{ 'tab-bar__tab--active': tab === 'files' }" @click="tab = 'files'">
        Files
      </button>
      <button class="tab-bar__tab tab-bar__tab--disabled" disabled>
        Spotify
        <span class="tab-bar__badge">Soon</span>
      </button>
    </div>

    <!-- Files tab content -->
    <template v-if="tab === 'files'">
      <div v-if="phase === 'pick'" class="proto-modal__body">
        <label class="btn btn--secondary">
          Choose Files
          <input type="file" accept=".csv,.json" multiple hidden @change="simulateImport" />
        </label>
        <p class="text-muted text-sm">Supported: CSV, JSON</p>
      </div>

      <div v-else-if="phase === 'progress'" class="proto-modal__body">
        <p class="text-muted">Importing…</p>
        <div class="proto-progress-bar">
          <div class="proto-progress-bar__fill proto-progress-bar__fill--indeterminate" />
        </div>
      </div>

      <div v-else-if="phase === 'done'" class="proto-modal__body">
        <p>Imported <strong>42</strong> tracks from <strong>2</strong> playlists</p>
      </div>
    </template>

    <div class="proto-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">
        {{ phase === 'done' ? 'Done' : 'Cancel' }}
      </button>
    </div>
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
.proto-modal__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); }
.proto-modal__body { display: flex; flex-direction: column; gap: var(--space-3); }
.proto-modal__footer { display: flex; justify-content: flex-end; gap: var(--space-2); }

/* Tab bar */
.tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-border-subtle);
}
.tab-bar__tab {
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: color var(--duration-fast) var(--ease-default),
              border-color var(--duration-fast) var(--ease-default);
}
.tab-bar__tab:hover:not(:disabled) { color: var(--color-text); }
.tab-bar__tab--active {
  color: var(--color-text);
  border-bottom-color: var(--color-accent);
}
.tab-bar__tab--disabled { opacity: 0.4; cursor: not-allowed; }
.tab-bar__badge {
  font-size: 10px;
  background: var(--gray-600);
  color: var(--gray-300);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  line-height: 1.4;
}

/* Progress bar mock */
.proto-progress-bar { height: 4px; background: var(--color-surface-raised); border-radius: var(--radius-full); overflow: hidden; }
.proto-progress-bar__fill { height: 100%; background: var(--color-accent); border-radius: var(--radius-full); }
.proto-progress-bar__fill--indeterminate { width: 40%; animation: proto-shimmer 1.2s ease-in-out infinite; }
@keyframes proto-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
</style>
