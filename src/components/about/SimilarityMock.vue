<script setup lang="ts">
defineProps<{ activeTab: number }>()

const overlapRows = [
  { name: 'Classic Blues', total: 44,  shared: 18, pct: 64, selected: true  },
  { name: 'Blues Covers',  total: 31,  shared: 11, pct: 36, selected: true  },
  { name: 'Best Licks',    total: 22,  shared: 7,  pct: 32, selected: false },
  { name: 'Classic Rock',  total: 66,  shared: 9,  pct: 14, selected: false },
  { name: 'Slow Burn',     total: 58,  shared: 4,  pct: 7,  selected: false },
  { name: 'Favorites',     total: 209, shared: 8,  pct: 4,  selected: false },
]

const equivPlaylists = ["R&B Classics", "Soul and Funk", "Good Horns", "90's Hip-Hop"]
const equivVersions = [
  { title: 'Respect',                    artist: 'Aretha Franklin',        album: 'I Never Loved a Man the Way I Love You',  preferred: true,  certainty: 'source',   cols: [true,  false, true,  false] },
  { title: 'Respect - Live',             artist: 'Aretha Franklin',        album: 'Aretha in Paris',                         preferred: false, certainty: 'high',     cols: [false, true,  false, false] },
  { title: 'Respect',                    artist: 'Otis Redding',           album: 'The Very Best of Otis Redding',           preferred: false, certainty: 'moderate', cols: [false, true,  true,  false] },
  { title: 'Respect - 2005 Remaster',   artist: 'The Notorious B.I.G.',   album: 'Ready to Die (The Remaster)',             preferred: false, certainty: 'low',      cols: [false, false, false, true ] },
]
</script>

<template>
  <!-- Tab 0: Overlap scan -->
  <div v-if="activeTab === 0" class="sim-panel">
    <div class="sim-panel-header">
      <span class="ws-title">Overlap with: <strong>Blues Rock</strong></span>
      <span class="ws-meta">51 tracks · 6 playlists</span>
      <div class="ws-header-actions">
        <button class="ws-btn ws-btn-ghost">Select all</button>
        <button class="ws-btn ws-btn-ghost">Merge playlists</button>
        <button class="ws-btn ws-btn-ghost">Open in Workspace</button>
      </div>
    </div>
    <div class="ws-table">
      <div class="ws-row ws-row-head sim-overlap-row">
        <div class="ws-cell sim-chk-col"></div>
        <div class="ws-cell sim-overlap-name-col">Playlist</div>
        <div class="ws-cell sim-overlap-size-col">Size</div>
        <div class="ws-cell sim-num-col">Shared</div>
        <div class="ws-cell sim-num-col">Overlap</div>
      </div>
      <div
        v-for="row in overlapRows"
        :key="row.name"
        class="ws-row sim-overlap-row"
        :class="{ 'sim-row-selected': row.selected }"
      >
        <div class="ws-cell sim-chk-col">
          <span :class="['ws-checkbox', row.selected && 'ws-checked']">{{ row.selected ? '✓' : '' }}</span>
        </div>
        <div class="ws-cell sim-overlap-name-col">
          <span class="ws-track-title">{{ row.name }}</span>
        </div>
        <div class="ws-cell sim-overlap-size-col">
          <span class="ws-track-artist">{{ row.total }} tracks</span>
        </div>
        <div class="ws-cell sim-num-col">
          <div class="sim-bar-wrap"><div class="sim-bar" :style="{ width: (row.shared / 18 * 100) + '%' }"></div></div>
          <span class="sim-num">{{ row.shared }}</span>
        </div>
        <div class="ws-cell sim-num-col">
          <span :class="['sim-pct', row.pct >= 50 && 'sim-pct-high']">{{ row.pct }}%</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Tab 1: Equivalents -->
  <div v-else-if="activeTab === 1" class="sim-panel">
    <div class="sim-panel-header">
      <span class="ws-title">Equivalent group: <strong>Respect</strong></span>
      <span class="ws-meta">4 versions · 4 playlists</span>
      <button class="ws-btn ws-btn-ghost">Mark Resolved</button>
      <button class="ws-btn ws-btn-ghost">Next Set »</button>
    </div>
    <div class="sim-equiv-table">
      <div class="sim-equiv-row sim-equiv-head">
        <div class="sim-equiv-cell sim-equiv-idx">#</div>
        <div class="sim-equiv-cell sim-equiv-track">Title / Artist</div>
        <div class="sim-equiv-cell sim-equiv-album">Album</div>
        <div v-for="pl in equivPlaylists" :key="pl" class="sim-equiv-cell sim-equiv-pl">{{ pl }}</div>
        <div class="sim-equiv-cell sim-equiv-certainty">Match</div>
        <div class="sim-equiv-cell sim-equiv-action"></div>
      </div>
      <div
        v-for="(ver, vi) in equivVersions"
        :key="ver.artist + vi"
        class="sim-equiv-row"
        :class="{ 'sim-preferred': ver.preferred }"
      >
        <div class="sim-equiv-cell sim-equiv-idx">{{ vi + 1 }}</div>
        <div class="sim-equiv-cell sim-equiv-track">
          <span class="ws-track-title">{{ ver.title }}</span>
          <span class="ws-track-artist">{{ ver.artist }}</span>
        </div>
        <div class="sim-equiv-cell sim-equiv-album">
          <span class="ws-track-artist">{{ ver.album }}</span>
        </div>
        <div v-for="(checked, ci) in ver.cols" :key="ci" class="sim-equiv-cell sim-equiv-pl">
          <span :class="['ws-checkbox', checked && 'ws-checked']">{{ checked ? '✓' : '' }}</span>
        </div>
        <div class="sim-equiv-cell sim-equiv-certainty">
          <span :class="['sim-cert', `sim-cert-${ver.certainty}`]">
            {{ ver.certainty === 'source' ? 'Source' : ver.certainty === 'high' ? 'High' : ver.certainty === 'moderate' ? 'Moderate' : 'Low' }}
          </span>
        </div>
        <div class="sim-equiv-cell sim-equiv-action">
          <span v-if="ver.preferred" class="sim-preferred-badge">Preferred</span>
          <button v-else class="ws-btn ws-btn-ghost sim-prefer-btn">Prefer</button>
        </div>
      </div>
    </div>
    <div class="sim-equiv-footer">
      <button class="ws-btn ws-btn-ghost">Consolidate to preferred</button>
      <button class="ws-btn ws-btn-ghost">Keep all versions</button>
      <button class="ws-btn ws-btn-ghost">Remove duplicates</button>
      <button class="ws-btn ws-btn-ghost">Add Manually</button>
    </div>
  </div>

  <!-- Tab 2: Similarity graph -->
  <div v-else class="sim-panel">
    <div class="sim-panel-header">
      <span class="ws-title">Similarity graph</span>
      <span class="ws-meta">node size = track count · edges = shared tracks above threshold</span>
    </div>
    <div class="sim-graph">
      <svg viewBox="0 0 840 320" fill="none" xmlns="http://www.w3.org/2000/svg" class="sim-graph-svg">
        <!-- edges -->
        <line x1="265" y1="121" x2="433" y2="81"  stroke="rgba(56,137,65,0.55)" stroke-width="6"/>
        <line x1="265" y1="121" x2="163" y2="216" stroke="rgba(56,137,65,0.35)" stroke-width="3"/>
        <line x1="265" y1="121" x2="386" y2="220" stroke="rgba(56,137,65,0.25)" stroke-width="2"/>
        <line x1="433" y1="81"  x2="559" y2="175" stroke="rgba(56,137,65,0.3)"  stroke-width="2.5"/>
        <line x1="433" y1="81"  x2="386" y2="220" stroke="rgba(56,137,65,0.2)"  stroke-width="1.5"/>
        <line x1="163" y1="216" x2="386" y2="220" stroke="rgba(56,137,65,0.15)" stroke-width="1.5"/>
        <line x1="559" y1="175" x2="634" y2="228" stroke="rgba(56,137,65,0.15)" stroke-width="1"/>
        <line x1="386" y1="220" x2="634" y2="228" stroke="rgba(56,137,65,0.1)"  stroke-width="1"/>
        <line x1="685" y1="81"  x2="559" y2="175" stroke="rgba(56,137,65,0.1)"  stroke-width="1"/>
        <line x1="756" y1="201" x2="634" y2="228" stroke="rgba(56,137,65,0.08)" stroke-width="1"/>
        <!-- nodes -->
        <circle cx="265" cy="121" r="45" fill="rgb(50,70,50)"  stroke="rgb(56,137,65)"       stroke-width="1.5"/>
        <circle cx="433" cy="81"  r="36" fill="rgb(46,66,46)"  stroke="rgb(56,137,65)"       stroke-width="1.5"/>
        <circle cx="163" cy="216" r="26" fill="rgb(40,60,40)"  stroke="rgba(56,137,65,0.7)"  stroke-width="1"/>
        <circle cx="386" cy="220" r="31" fill="rgb(40,60,40)"  stroke="rgba(56,137,65,0.7)"  stroke-width="1"/>
        <circle cx="559" cy="175" r="20" fill="rgb(40,60,40)"  stroke="rgba(56,137,65,0.5)"  stroke-width="1"/>
        <circle cx="634" cy="228" r="17" fill="rgb(36,56,36)"  stroke="rgba(56,137,65,0.4)"  stroke-width="1"/>
        <circle cx="685" cy="81"  r="30" fill="rgb(36,56,36)"  stroke="rgba(56,137,65,0.5)"  stroke-width="1"/>
        <circle cx="756" cy="201" r="14" fill="rgb(32,52,32)"  stroke="rgba(56,137,65,0.4)"  stroke-width="1"/>
        <circle cx="76"  cy="80"  r="13" fill="rgb(40,60,40)"  stroke="rgba(56,137,65,0.25)" stroke-width="0.7"/>
        <circle cx="55"  cy="274" r="30" fill="rgb(40,60,40)"  stroke="rgba(56,137,65,0.25)" stroke-width="0.7"/>
        <circle cx="783" cy="301" r="10" fill="rgb(40,60,40)"  stroke="rgba(56,137,65,0.2)"  stroke-width="0.7"/>
        <circle cx="699" cy="292" r="22" fill="rgb(40,60,40)"  stroke="rgba(56,137,65,0.3)"  stroke-width="0.7"/>
        <circle cx="112" cy="156" r="10" fill="rgb(40,60,40)"  stroke="rgba(56,137,65,0.2)"  stroke-width="0.7"/>
        <!-- labels -->
        <text x="265" y="123" text-anchor="middle" fill="white"                  font-size="10" font-family="system-ui">Blues Rock</text>
        <text x="433" y="85"  text-anchor="middle" fill="white"                  font-size="10" font-family="system-ui">Classic Blues</text>
        <text x="163" y="218" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-size="9"  font-family="system-ui">Best Licks</text>
        <text x="386" y="222" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-size="9"  font-family="system-ui">Blues Covers</text>
        <text x="559" y="177" text-anchor="middle" fill="rgba(255,255,255,0.6)"  font-size="8"  font-family="system-ui">Slow Burn</text>
        <text x="634" y="230" text-anchor="middle" fill="rgba(255,255,255,0.5)"  font-size="8"  font-family="system-ui">Late Night</text>
        <text x="685" y="83"  text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="9"  font-family="system-ui">Favorites</text>
        <text x="756" y="203" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="8"  font-family="system-ui">Folk</text>
        <text x="76"  y="82"  text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="8"  font-family="system-ui">Ambient</text>
        <text x="55"  y="276" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="9"  font-family="system-ui">Workout</text>
        <text x="699" y="294" text-anchor="middle" fill="rgba(255,255,255,0.4)"  font-size="8"  font-family="system-ui">Jazz</text>
        <text x="783" y="304" text-anchor="middle" fill="rgba(255,255,255,0.3)"  font-size="7"  font-family="system-ui">Sleep</text>
      </svg>
      <div class="sim-graph-overlay">
        <label class="sim-slider-label">Overlap threshold</label>
        <input type="range" min="0" max="100" value="25" class="sim-slider" />
        <span class="sim-slider-val">25%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './mock-shared.css';

/* larger checkboxes for sim panels */
.ws-checkbox { width: 20px; height: 20px; }

.sim-panel { display: flex; flex-direction: column; height: 100%; }
.sim-panel-header {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
  flex-shrink: 0;
}

/* Overlap table */
.sim-overlap-row {
  grid-template-columns: 34px minmax(120px, 1.4fr) minmax(74px, 0.9fr) minmax(100px, 1.1fr) minmax(74px, 0.9fr);
}
.sim-overlap-row .ws-cell { font-size: var(--font-size-xs); }
.sim-chk-col { justify-content: center; min-width: 50px; cursor: pointer; }
.sim-overlap-name-col { overflow: hidden; min-width: 0; }
.sim-overlap-size-col { justify-content: center; min-width: 0; }
.sim-num-col { justify-content: space-between; gap: var(--space-3); min-width: 0; }
.sim-bar-wrap { flex: 1; height: 4px; background: var(--color-surface-raised); border-radius: 2px; overflow: hidden; margin: 0 var(--space-3); }
.sim-bar { height: 100%; background: var(--color-accent); border-radius: 2px; }
.sim-num { min-width: 18px; text-align: right; color: var(--color-text); font-weight: var(--font-weight-semibold); }
.sim-pct { color: var(--color-text-muted); }
.sim-pct-high { color: var(--color-accent-hover); font-weight: var(--font-weight-semibold); }
.sim-row-selected { background: color-mix(in srgb, var(--color-accent) 6%, transparent); }

/* Equivalents */
.sim-equiv-table { display: flex; flex-direction: column; overflow-y: auto; flex: 1; }
.sim-equiv-row {
  display: grid;
  grid-template-columns: 24px minmax(140px, 1.2fr) minmax(120px, 1fr) repeat(4, 70px) 72px 90px;
  align-items: center;
  padding: 0 var(--space-2);
  min-height: 38px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-xs);
}
.sim-equiv-head {
  background: var(--color-surface-raised);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  position: sticky; top: 0; z-index: 1;
}
.sim-equiv-cell { display: flex; align-items: center; padding: 0 var(--space-2); overflow: hidden; }
.sim-equiv-idx       { justify-content: center; color: var(--color-text-muted); }
.sim-equiv-track     { flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; }
.sim-equiv-album     { min-width: 0; }
.sim-equiv-album .ws-track-artist { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; max-width: 100%; }
.sim-equiv-pl        { justify-content: center; font-size: 9px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
.sim-equiv-certainty { justify-content: center; }
.sim-equiv-action    { justify-content: flex-end; }
.sim-prefer-btn { font-size: 11px; }

.sim-cert { font-size: 10px; padding: 1px 6px; border-radius: var(--radius-full); border: 1px solid; white-space: nowrap; }
.sim-cert-source   { color: #000; border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 90%, transparent); }
.sim-cert-high     { color: var(--color-accent-hover); border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 12%, transparent); }
.sim-cert-moderate { color: #c99227; border-color: #b07a18; background: color-mix(in srgb, #c09030 12%, transparent); }
.sim-cert-low      { color: #e67272; border-color: #e67272; background: color-mix(in srgb, #e67272 12%, transparent); }
.sim-preferred { background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
.sim-preferred-badge {
  font-size: 11px;
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  border: 1px solid var(--color-accent);
  color: var(--color-accent-hover);
}
.sim-equiv-footer {
  display: flex; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
  flex-shrink: 0;
}

/* Graph */
.sim-graph { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; padding: var(--space-3); }
.sim-graph-svg { width: 100%; max-width: 840px; height: 250px; }
.sim-graph-overlay {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--gray-800);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 10px 24px rgba(0,0,0,0.12);
}
.sim-slider-label { font-size: var(--font-size-xs); color: var(--color-text-muted); white-space: nowrap; }
.sim-slider { width: 81px; accent-color: var(--color-accent); }
.sim-slider-val { font-size: var(--font-size-xs); color: var(--color-text-muted); min-width: 30px; }
</style>
