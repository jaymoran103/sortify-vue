<script setup lang="ts">
import { computed } from 'vue'
import { useContextMenu } from '@/composables/useContextMenu'
import type { ResultRow } from '@/similarity/types'

const props = defineProps<{ selectedRows: ResultRow[] }>()
const emit = defineEmits<{
  openInWorkspace: []
  saveAsSession: []
  createPlaylist: [mode: 'union' | 'intersection' | 'complement']
  analyze: []
}>()

const contextMenu = useContextMenu()

const hasSelection = computed(() => props.selectedRows.length > 0)
const isTrackSubject = computed(() => props.selectedRows[0]?.subject === 'track')

// Track rows reach the workspace through the playlists containing them, so the label says so
// rather than implying the tracks open on their own.
const openLabel = computed(() =>
  isTrackSubject.value ? 'Open their playlists in workspace' : 'Open in workspace',
)

// Set operations are actions producing playlists, not computed columns, so they live behind a
// menu on this strip rather than as columns on the table.
function showCreateMenu(event: MouseEvent): void {
  contextMenu.show(event, [
    { label: 'Union', action: () => emit('createPlaylist', 'union') },
    { label: 'Intersection', action: () => emit('createPlaylist', 'intersection') },
    { label: 'Complement', action: () => emit('createPlaylist', 'complement') },
  ])
}
</script>

<template>
  <div class="result-verb-strip">
    <span class="result-verb-strip__count text-muted text-sm">
      {{ selectedRows.length }} selected
    </span>

    <button
      class="result-verb-strip__open btn btn--primary btn--sm"
      :disabled="!hasSelection"
      @click="emit('openInWorkspace')"
    >
      {{ openLabel }}
    </button>

    <button
      class="result-verb-strip__save btn btn--secondary btn--sm"
      :disabled="!hasSelection"
      @click="emit('saveAsSession')"
    >
      Save as session
    </button>

    <button
      class="result-verb-strip__create btn btn--secondary btn--sm"
      :disabled="!hasSelection"
      @click="showCreateMenu"
    >
      Create playlist from
    </button>

    <button
      class="result-verb-strip__analyze btn btn--secondary btn--sm"
      :disabled="!hasSelection"
      @click="emit('analyze')"
    >
      Analyze
    </button>
  </div>
</template>

<style scoped>
.result-verb-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
}

.result-verb-strip__count {
  margin-right: auto;
}
</style>
