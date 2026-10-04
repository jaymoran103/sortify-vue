<script setup lang="ts">
defineProps<{ activeTab: number }>()

const song = "Knockin' on Heaven's Door"
const playlists = ['Dylan Essentials', 'Road Trip', 'Sunday Morning', 'Guitar Heroes']

// before: where each version sits now. after: the result once one version is kept.
// kept marks an exception the user chose to leave in place.
const versions = [
  { artist: 'Bob Dylan',          label: 'Studio',     match: 'Original', before: [true,  false, true,  false], after: [true,  true,  true,  false], kept: [false, false, false, false] },
  { artist: 'Bob Dylan',          label: 'Live',       match: 'Same artist', before: [false, true,  false, false], after: [false, false, false, false], kept: [false, false, false, false] },
  { artist: 'Dylan & the Dead',   label: 'Live',       match: 'Same artist', before: [false, true,  true,  false], after: [false, false, false, false], kept: [false, false, false, false] },
  { artist: 'Eric Clapton',       label: 'Cover',      match: 'Cover',    before: [false, true,  false, true ], after: [false, false, false, true ], kept: [false, false, false, true ] },
]
</script>

<template>
  <div class="db-panel">
    <div class="db-header">
      <span class="ws-title">Doubles: <strong>{{ song }}</strong></span>
      <span class="ws-meta">{{ versions.length }} versions · {{ playlists.length }} playlists</span>
      <button class="ws-btn" :class="activeTab === 2 ? 'ws-btn-primary' : 'ws-btn-ghost'">
        {{ activeTab === 2 ? 'Applied' : 'Keep one' }}
      </button>
    </div>

    <div class="ws-table" :class="{ 'db-folded': activeTab <= 0 }">
      <div class="ws-row ws-row-head db-row">
        <div class="ws-cell">Version</div>
        <div class="ws-cell db-center">Match</div>
        <div v-for="pl in playlists" :key="pl" class="ws-cell db-center db-pl">{{ pl }}</div>
      </div>

      <div
        v-for="(v, vi) in versions"
        :key="v.artist + v.label"
        class="ws-row db-row"
        :class="{ 'db-preferred': activeTab === 2 && vi === 0, 'ws-muted': activeTab === 2 && vi > 0 && !v.kept.includes(true) }"
      >
        <div class="ws-cell ws-track-col">
          <span class="ws-track-title">{{ v.artist }}</span>
          <span class="ws-track-artist">{{ v.label }}</span>
        </div>
        <div class="ws-cell db-center">
          <span v-if="activeTab === 2 && vi === 0" class="db-badge db-badge-keep">Preferred</span>
          <span v-else class="db-badge">{{ v.match }}</span>
        </div>
        <div v-for="(_, ci) in playlists" :key="ci" class="ws-cell db-center db-pl">
          <template v-if="activeTab === 2">
            <span v-if="v.kept[ci]" class="db-exception" title="Kept as an exception">✓ kept</span>
            <span v-else :class="['ws-checkbox', v.after[ci] && 'ws-checked']">{{ v.after[ci] ? '✓' : '' }}</span>
          </template>
          <span v-else :class="['ws-checkbox', v.before[ci] && 'ws-checked']">{{ v.before[ci] ? '✓' : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './mock-shared.css';

.db-panel { display: flex; flex-direction: column; height: 100%; }
.db-header {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
}

.db-row { grid-template-columns: minmax(150px, 1.4fr) 110px repeat(4, minmax(90px, 1fr)); }
.db-row .ws-cell { font-size: var(--font-size-xs); }
.db-center { justify-content: center; text-align: center; }

/* Tab 0: only the labelled column of versions. Playlist columns fold away. */
.db-pl { transition: opacity 0.2s ease; }
.db-folded .db-pl { opacity: 0; }

.db-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
  white-space: nowrap;
}
.db-badge-keep { border-color: var(--color-accent); color: var(--color-accent-hover); background: var(--color-accent-subtle); }
.db-preferred { background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
.db-exception {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  border: 1px dashed var(--color-accent);
  color: var(--color-accent-hover);
  white-space: nowrap;
}
</style>
