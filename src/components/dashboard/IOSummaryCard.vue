<script setup lang="ts">
import { ref, computed } from 'vue'
import { useActivityStore } from '@/stores/activity'
import ErrorSummary from '@/components/common/ErrorSummary.vue'
import type { ActivityItem, OperationSource } from '@/types/ui'

// Number of recent operations to show before collapsing into optional "show more" list.
const VISIBLE_COUNT = 3

const store = useActivityStore()

const showAll = ref(false)
const expandedIds = ref(new Set<string>())

// Compute the list of operations to display based on showAll state. 
// If showAll is false, only show the most recent VISIBLE_COUNT operations. otherwise show all.
const visibleOperations = computed((): ActivityItem[] => {
  const ops = store.recentOperations
  return showAll.value ? ops : ops.slice(0, VISIBLE_COUNT)
})

const hasMore = computed(() => store.recentOperations.length > VISIBLE_COUNT)

// Toggle the expanded state of an operation's details by its ID. 
// Expanded state is tracked in a Set of IDs.
function toggleExpand(id: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

// Mapping of operation sources to user-friendly labels for display in the summary card.
const SOURCE_LABELS: Record<OperationSource, string> = {
  'file-import': 'File Import',
  'file-export': 'File Export',
  'spotify-import': 'Spotify Import',
  'spotify-export': 'Spotify Export',
}

function rowLabel(op: ActivityItem): string {
  return op.source ? SOURCE_LABELS[op.source] : op.label
}

// Builds a summary line for expanded view showing counts of tracks, playlists, and warnings.
function summaryLine(op: ActivityItem): string {
  const s = op.summary
  if (!s) return ''
  const parts: string[] = []
  if (s.tracks) parts.push(`${s.tracks} track${s.tracks !== 1 ? 's' : ''}`)
  if (s.playlists) parts.push(`${s.playlists} playlist${s.playlists !== 1 ? 's' : ''}`)
  if (s.warnings) parts.push(`${s.warnings} warning${s.warnings !== 1 ? 's' : ''}`)
  return parts.join(' · ')
}
// TODO need better way to express warnings
// Done - N warnings? Done (N warnings)? N Warnings?
function statusLabel(op: ActivityItem): string {
  if (op.status === 'done') {
    return op.summary?.warnings ? 'Done with warnings' : 'Done'
  }
  return 'Failed'
}
</script>

<template>
  <div v-if="store.recentOperations.length > 0" class="io-summary-card">
    <div class="io-summary-card__header">
      <span class="text-sm text-muted">Recent</span>
      <button class="io-summary-card__clear-all text-sm" @click="store.clearHistory">
        Clear all
      </button>
    </div>

    <div class="io-summary-card__list">
      <div
        v-for="op in visibleOperations"
        :key="op.id"
        class="io-summary-card__row"
        :class="{ 'io-summary-card__row--error': op.status === 'error' }"
      >
        <!-- Collapsed row: expand toggle · label · status · dismiss -->
        <div class="io-summary-card__row-main">
          <button
            class="io-summary-card__expand-btn"
            :aria-label="expandedIds.has(op.id) ? 'Collapse details' : 'Expand details'"
            @click="toggleExpand(op.id)"
          >
            {{ expandedIds.has(op.id) ? '▲' : '▼' }}
          </button>

          <span class="io-summary-card__row-label text-sm">{{ rowLabel(op) }}</span>

          <span
            class="io-summary-card__row-status text-sm"
            :class="{
              'io-summary-card__row-status--done': op.status === 'done' && !op.summary?.warnings,
              'io-summary-card__row-status--warnings': op.status === 'done' && op.summary?.warnings,
              'io-summary-card__row-status--error': op.status === 'error',
            }"
          >{{ statusLabel(op) }}</span>

          <button
            class="io-summary-card__dismiss-btn"
            :aria-label="`Dismiss ${rowLabel(op)}`"
            @click="store.dismissHistoryItem(op.id)"
          >×</button>
        </div>

        <!-- Expanded detail area: counts · errors · links -->
        <div v-if="expandedIds.has(op.id)" class="io-summary-card__details">
          <p v-if="summaryLine(op)" class="io-summary-card__summary-line text-sm text-muted">
            {{ summaryLine(op) }}
          </p>
          <ErrorSummary v-if="op.errors.length > 0" :errors="op.errors" />
          <ul v-if="op.summary?.linkItems?.length" class="io-summary-card__links">
            <li
              v-for="link in op.summary.linkItems"
              :key="link.href"
              class="io-summary-card__link-item"
            >
              <a :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <button
      v-if="hasMore"
      class="io-summary-card__show-more text-sm text-muted"
      @click="showAll = !showAll"
    >
      {{ showAll ? 'Show less' : `${store.recentOperations.length - VISIBLE_COUNT} more…` }}
    </button>
  </div>
</template>

<style scoped>
.io-summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
  margin-top: var(--space-2);
  flex: 1;
  min-height: 0;
}

.io-summary-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.io-summary-card__clear-all {
  all: unset;
  cursor: pointer;
  color: var(--color-text-muted);
  text-decoration: underline;
}

.io-summary-card__clear-all:hover {
  color: var(--color-text);
}

.io-summary-card__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.io-summary-card__row {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
}

.io-summary-card__row--error {
  border-left: 2px solid var(--color-danger);
}

.io-summary-card__row-main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.io-summary-card__row-label {
  font-weight: var(--font-weight-medium);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.io-summary-card__row-status {
  flex-shrink: 0;
}

.io-summary-card__row-status--done {
  color: var(--color-accent);
}

.io-summary-card__row-status--warnings {
  color: var(--color-text-muted);
}

.io-summary-card__row-status--error {
  color: var(--color-danger);
}

.io-summary-card__expand-btn {
  all: unset;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  flex-shrink: 0;
  line-height: 1;
}

.io-summary-card__expand-btn:hover {
  color: var(--color-text);
}

.io-summary-card__dismiss-btn {
  all: unset;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  flex-shrink: 0;
  line-height: 1;
}

.io-summary-card__dismiss-btn:hover {
  color: var(--color-danger);
}

.io-summary-card__details {
  padding-top: var(--space-2);
  margin-top: var(--space-2);
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.io-summary-card__summary-line {
  margin: 0;
}

.io-summary-card__links {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.io-summary-card__link-item {
  font-size: var(--font-size-sm);
}

.io-summary-card__link-item a {
  color: var(--color-accent);
}

.io-summary-card__link-item a:hover {
  color: var(--color-accent-hover);
}

.io-summary-card__show-more {
  all: unset;
  cursor: pointer;
  text-decoration: underline;
  align-self: flex-start;
}

.io-summary-card__show-more:hover {
  color: var(--color-text);
}
</style>
