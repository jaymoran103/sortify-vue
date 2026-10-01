<!-- Library history prototype: import JSON bundle snapshots and chart how the library changes. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import SnapshotImport from './SnapshotImport.vue'
import TimeSeriesChart from './TimeSeriesChart.vue'
import { useHistoryStore } from '@/stores/history'
import { BREAKDOWNS, compositionChart, duplicationChart, playlistsChart } from '@/utils/historySeries'
import type { Breakdown } from '@/types/history'

const store = useHistoryStore()
const breakdown = ref<Breakdown>('duplication')

const composition = computed(() => compositionChart(store.snapshots, breakdown.value))
const duplication = computed(() => duplicationChart(store.snapshots))
const playlists = computed(() => playlistsChart(store.snapshots))

const numFmt = new Intl.NumberFormat()
const pctFmt = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })
const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function signed(n: number): string {
  return n > 0 ? `+${numFmt.format(n)}` : n < 0 ? `−${numFmt.format(-n)}` : '0'
}

// Headline figures for the newest snapshot, each with its change since the previous one.
const tiles = computed(() => {
  const list = store.snapshots
  const cur = list[list.length - 1]?.stats
  if (!cur) return []
  const prev = list[list.length - 2]?.stats
  const delta = (a: number, b: number | undefined) => (b === undefined ? null : signed(a - b))
  const dupShare = cur.entries ? cur.duplicateEntries / cur.entries : 0
  return [
    { label: 'Tracks', value: numFmt.format(cur.tracks), delta: delta(cur.tracks, prev?.tracks) },
    { label: 'Playlists', value: numFmt.format(cur.playlists), delta: delta(cur.playlists, prev?.playlists) },
    { label: 'Playlist entries', value: numFmt.format(cur.entries), delta: delta(cur.entries, prev?.entries) },
    {
      label: 'Duplicate entries',
      value: numFmt.format(cur.duplicateEntries),
      delta: delta(cur.duplicateEntries, prev?.duplicateEntries),
      note: `${pctFmt.format(dupShare)} of entries`,
    },
    { label: 'Artists', value: numFmt.format(cur.artists), delta: delta(cur.artists, prev?.artists) },
    { label: 'Hours', value: numFmt.format(Math.round(cur.durationMs / 3_600_000)), delta: null },
  ]
})

// Table rows, newest first, so the latest change reads at the top.
const rows = computed(() => store.snapshots.map((s, i) => ({ s, d: store.diffs[i] })).reverse())

const noGenres = computed(() =>
  breakdown.value === 'genre' && composition.value.series.every((s) => s.key === 'Unknown'),
)
</script>

<template>
  <div class="history">
    <header class="history__header">
      <h1 class="history__title">Library history</h1>
      <button class="btn btn--ghost" @click="$router.push({ name: 'dashboard' })">Dashboard</button>
    </header>

    <SnapshotImport />

    <p v-if="!store.snapshots.length && !store.importing" class="history__empty text-muted">
      No snapshots yet. Export a JSON bundle from the dashboard now and then, and load them all here.
    </p>

    <template v-else-if="store.snapshots.length">
      <section class="history__tiles" aria-label="Latest snapshot">
        <div v-for="t in tiles" :key="t.label" class="history__tile">
          <span class="history__tile-label">{{ t.label }}</span>
          <span class="history__tile-value">{{ t.value }}</span>
          <span class="history__tile-delta">
            <template v-if="t.delta !== null">{{ t.delta }} since previous</template>
            <template v-if="t.note">{{ t.delta !== null ? ' · ' : '' }}{{ t.note }}</template>
          </span>
        </div>
      </section>

      <section class="history__card">
        <div class="history__card-header">
          <h2 class="history__card-title">Library size</h2>
          <SelectDropdown v-model="breakdown" :options="[...BREAKDOWNS]" title="Break tracks down by" />
        </div>
        <p v-if="noGenres" class="text-muted text-sm">These bundles carry no genre data.</p>
        <TimeSeriesChart
          :series="composition.series"
          :points="composition.points"
          stacked
          :height="280"
          summary="Unique tracks per snapshot, stacked by breakdown"
        />
      </section>

      <div class="history__pair">
        <section class="history__card">
          <h2 class="history__card-title">Duplication</h2>
          <TimeSeriesChart
            :series="duplication.series"
            :points="duplication.points"
            summary="Duplicate playlist entries per snapshot"
          />
        </section>
        <section class="history__card">
          <h2 class="history__card-title">Playlists</h2>
          <TimeSeriesChart
            :series="playlists.series"
            :points="playlists.points"
            summary="Playlist count per snapshot"
          />
        </section>
      </div>

      <section class="history__card">
        <h2 class="history__card-title">Snapshots</h2>
        <div class="history__table-wrap">
          <table class="history__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>File</th>
                <th class="num">Tracks</th>
                <th class="num">Added</th>
                <th class="num">Removed</th>
                <th class="num">Playlists</th>
                <th class="num">Entries</th>
                <th class="num">Duplicates</th>
                <th class="num">In 2+</th>
                <th class="num">No playlist</th>
                <th class="num">Missing</th>
                <th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ s, d } in rows" :key="s.id">
                <td>
                  {{ dateFmt.format(s.takenAt) }}
                  <span
                    v-if="s.takenAtSource === 'fileModified'"
                    class="history__flag"
                    title="No exportedAt in this bundle. Dated by file modified time."
                  >file date</span>
                </td>
                <td class="history__file" :title="s.fileName">{{ s.fileName }}</td>
                <td class="num">{{ numFmt.format(s.stats.tracks) }}</td>
                <td class="num">{{ d ? signed(d.tracksAdded) : '' }}</td>
                <td class="num">{{ d ? signed(-d.tracksRemoved) : '' }}</td>
                <td class="num">
                  {{ numFmt.format(s.stats.playlists) }}
                  <span v-if="d && (d.playlistsAdded || d.playlistsRemoved)" class="text-muted">
                    ({{ signed(d.playlistsAdded) }}/{{ signed(-d.playlistsRemoved) }})
                  </span>
                </td>
                <td class="num">{{ numFmt.format(s.stats.entries) }}</td>
                <td class="num">{{ numFmt.format(s.stats.duplicateEntries) }}</td>
                <td class="num">{{ numFmt.format(s.stats.inManyPlaylists) }}</td>
                <td class="num">{{ numFmt.format(s.stats.orphans) }}</td>
                <td class="num">{{ numFmt.format(s.stats.missing) }}</td>
                <td>
                  <button
                    class="btn btn--ghost btn--sm"
                    :aria-label="`Remove ${s.fileName}`"
                    @click="store.removeSnapshot(s.id)"
                  >Remove</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}

.history__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.history__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.history__empty {
  text-align: center;
}

.history__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
}

.history__tile {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.history__tile-label,
.history__tile-delta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.history__tile-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.history__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  min-width: 0;
}

.history__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.history__card-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.history__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
  gap: var(--space-5);
}

@media (max-width: 600px) {
  .history {
    padding: var(--space-4);
  }

  .history__card {
    padding: var(--space-4);
  }
}

.history__table-wrap {
  overflow-x: auto;
}

.history__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.history__table th,
.history__table td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border-subtle);
  text-align: left;
  white-space: nowrap;
}

.history__table th {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

.history__table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.history__file {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history__flag {
  margin-left: var(--space-1);
  padding: 0 var(--space-1);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-sm);
  color: var(--color-warning);
  font-size: var(--font-size-xs);
}
</style>
