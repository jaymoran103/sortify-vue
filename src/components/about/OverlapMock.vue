<script setup lang="ts">
defineProps<{ activeTab: number }>()

// Reference playlist and the pair compared in tabs 1 and 2
const reference = { name: 'Blues Rock', total: 51 }
const pair = { name: 'Classic Blues', total: 44, shared: 18 }

// Ranked by shared tracks. pct = share of the reference each playlist holds.
const overlapRows = [
  { name: 'Classic Blues', total: 44,  shared: 18 },
  { name: 'Blues Covers',  total: 31,  shared: 11 },
  { name: 'Classic Rock',  total: 66,  shared: 9  },
  { name: 'Favorites',     total: 209, shared: 8  },
  { name: 'Best Riffs',    total: 22,  shared: 7  },
  { name: 'Slow Burn',     total: 58,  shared: 4  },
].map((row) => ({ ...row, pct: Math.round((row.shared / reference.total) * 100) }))
const maxShared = overlapRows[0]!.shared

const sharedTracks = [
  { title: 'The Thrill is Gone',    artist: 'B.B. King' },
  { title: 'Pride and Joy',         artist: 'Stevie Ray Vaughan' },
  { title: 'Born Under a Bad Sign', artist: 'Albert King' },
  { title: 'Boom Boom',             artist: 'John Lee Hooker' },
  { title: 'Hoochie Coochie Man',   artist: 'Muddy Waters' },
]
</script>

<template>
  <!-- Tab 0 (and the resting state): rank every playlist against the reference -->
  <div v-if="activeTab <= 0" class="ov-panel">
    <div class="ov-header">
      <span class="ws-title">Overlap with <strong>{{ reference.name }}</strong></span>
      <span class="ws-meta">{{ reference.total }} tracks · {{ overlapRows.length }} playlists</span>
    </div>
    <div class="ws-table">
      <div class="ws-row ws-row-head ov-row">
        <div class="ws-cell">Playlist</div>
        <div class="ws-cell ov-center">Size</div>
        <div class="ws-cell">Shared</div>
        <div class="ws-cell ov-center">Of reference</div>
      </div>
      <div v-for="row in overlapRows" :key="row.name" class="ws-row ov-row">
        <div class="ws-cell"><span class="ws-track-title">{{ row.name }}</span></div>
        <div class="ws-cell ov-center"><span class="ws-track-artist">{{ row.total }} tracks</span></div>
        <div class="ws-cell ov-bar-cell">
          <div class="ov-bar-wrap"><div class="ov-bar" :style="{ width: (row.shared / maxShared * 100) + '%' }"></div></div>
          <span class="ov-num">{{ row.shared }}</span>
        </div>
        <div class="ws-cell ov-center"><span class="ws-track-artist">{{ row.pct }}%</span></div>
      </div>
    </div>
  </div>

  <!-- Tabs 1 and 2: the pair as a Venn -->
  <div v-else class="ov-panel">
    <div class="ov-header">
      <span class="ws-title">{{ reference.name }} <span class="ws-meta">and</span> {{ pair.name }}</span>
      <span class="ws-meta"></span>
      <button class="ws-btn" :class="activeTab === 2 ? 'ws-btn-primary' : 'ws-btn-ghost'">Actions</button>
    </div>

    <div class="ov-compare">
      <svg class="ov-venn" :class="{ 'ov-venn-focus': activeTab === 2 }" viewBox="0 0 400 230" role="img"
        :aria-label="`${reference.name} and ${pair.name} share ${pair.shared} tracks`">
        <defs>
          <clipPath id="ov-clip-left"><circle cx="150" cy="120" r="100" /></clipPath>
        </defs>
        <circle class="ov-set" cx="150" cy="120" r="100" />
        <circle class="ov-set" cx="250" cy="120" r="100" />
        <circle class="ov-both" cx="250" cy="120" r="100" clip-path="url(#ov-clip-left)" />

        <text class="ov-count" x="100" y="126">{{ reference.total - pair.shared }}</text>
        <text class="ov-count ov-count-both" x="200" y="126">{{ pair.shared }}</text>
        <text class="ov-count" x="300" y="126">{{ pair.total - pair.shared }}</text>

        <text class="ov-name" x="100" y="148">only here</text>
        <text class="ov-name" x="200" y="148">in both</text>
        <text class="ov-name" x="300" y="148">only there</text>
      </svg>

      <div class="ov-list" :class="{ 'ws-muted': activeTab === 2 }">
        <div class="ov-list-title">In both <span class="ws-meta">{{ pair.shared }} tracks</span></div>
        <div v-for="t in sharedTracks" :key="t.title" class="ov-list-row">
          <span class="ws-track-title">{{ t.title }}</span>
          <span class="ws-track-artist">{{ t.artist }}</span>
        </div>
        <div class="ov-list-more ws-track-artist">and {{ pair.shared - sharedTracks.length }} more</div>
      </div>
    </div>

    <!-- Tab 2: what to do with the overlap -->
    <div v-if="activeTab === 2" class="ws-menu ov-menu">
      <div class="ws-dropdown-title">In both <span class="ws-meta">{{ pair.shared }} tracks</span></div>
      <div class="ws-dropdown-item">Save as new playlist</div>
      <div class="ws-dropdown-item">Add {{ pair.name }} to reference</div>
      <div class="ws-dropdown-item">Open both in Workspace</div>
      <div class="ws-dropdown-item ws-dropdown-danger">Remove from {{ pair.name }}</div>
    </div>
  </div>
</template>

<style scoped>
@import './mock-shared.css';

.ov-panel { display: flex; flex-direction: column; height: 100%; }
.ov-header {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
}

/* Ranking table */
.ov-row { grid-template-columns: minmax(120px, 1.3fr) minmax(80px, 0.8fr) minmax(140px, 1.4fr) minmax(90px, 0.8fr); }
.ov-row .ws-cell { font-size: var(--font-size-xs); }
.ov-center { justify-content: center; }
.ov-bar-cell { gap: var(--space-3); }
.ov-bar-wrap { flex: 1; height: 6px; background: var(--color-surface-raised); border-radius: 3px; overflow: hidden; }
.ov-bar { height: 100%; background: var(--color-accent); border-radius: 3px; }
.ov-num { min-width: 18px; text-align: right; color: var(--color-text); font-weight: var(--font-weight-semibold); }

/* Venn + shared list */
.ov-compare {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4);
}
.ov-venn { width: 100%; height: auto; }
.ov-set {
  fill: color-mix(in srgb, var(--color-accent) 10%, transparent);
  stroke: var(--color-border-subtle);
  stroke-width: 1.5;
}
.ov-both {
  fill: color-mix(in srgb, var(--color-accent) 35%, transparent);
  stroke: var(--color-accent);
  stroke-width: 1.5;
  transition: fill 0.15s ease;
}
.ov-venn-focus .ov-both { fill: color-mix(in srgb, var(--color-accent) 60%, transparent); }
.ov-count { text-anchor: middle; font-size: 22px; font-weight: 600; fill: var(--color-text); }
.ov-name { text-anchor: middle; font-size: 11px; fill: var(--color-text-muted); }

.ov-list { display: flex; flex-direction: column; font-size: var(--font-size-xs); }
.ov-list-title {
  display: flex; gap: var(--space-2); align-items: baseline;
  font-weight: var(--font-weight-semibold); color: var(--color-text);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border-subtle);
}
.ov-list-row {
  display: flex; flex-direction: column; gap: 2px;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}
.ov-list-more { padding-top: var(--space-2); }

.ov-menu { position: absolute; top: 48px; right: var(--space-4); }
</style>
