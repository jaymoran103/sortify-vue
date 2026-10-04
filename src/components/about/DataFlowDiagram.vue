<script setup lang="ts">
// Where your music lives, as three bands: the web, your browser, your files.
// Spotify syncs straight down and back, or Exportify carries it down as CSV.
// The browser saves to and loads from files. Each place is drawn as the thing it is:
// an app, a website, a browser window, a laptop.
</script>

<template>
  <div class="flow">
    <!-- Band: the web -->
    <div class="flow-band" style="grid-row: 1">
      <span class="flow-band-name">The web</span>
      <span class="flow-band-sub">Music providers and exporters</span>
    </div>

    <!-- Spotify, drawn as a desktop app window -->
    <div class="flow-node flow-node-row flow-node-main" style="grid-row: 1; grid-column: 4">
      <svg class="flow-icon" viewBox="0 0 40 32" aria-hidden="true">
        <rect x="1" y="1" width="38" height="30" rx="4" />
        <line x1="1" y1="8" x2="39" y2="8" />
        <circle class="flow-icon-fill" cx="5" cy="4.5" r="1" />
        <circle class="flow-icon-fill" cx="8.5" cy="4.5" r="1" />
        <line x1="12" y1="8" x2="12" y2="31" />
        <path d="M23 25V14l9-2v11" />
        <circle cx="21" cy="25" r="2" />
        <circle cx="30" cy="23" r="2" />
      </svg>
      <div class="flow-text">
        <a class="flow-label flow-link" href="https://open.spotify.com" target="_blank" rel="noopener">Spotify ↗</a>
        <div class="flow-desc">Main source. Syncs both ways.</div>
      </div>
    </div>
    <div class="flow-edge flow-edge-h flow-edge-side" style="grid-row: 1; grid-column: 5">
      <i class="flow-head flow-head-end"></i>
    </div>

    <!-- Exportify, a side path: drawn as a website -->
    <div class="flow-node flow-node-row flow-node-optional" style="grid-row: 1; grid-column: 6">
      <svg class="flow-icon" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" />
        <ellipse cx="16" cy="16" rx="6" ry="14" />
        <line x1="2" y1="16" x2="30" y2="16" />
        <path d="M5 9h22M5 23h22" />
      </svg>
      <div class="flow-text">
        <a class="flow-label flow-link" href="https://exportify.net" target="_blank" rel="noopener">Exportify ↗</a>
        <div class="flow-desc">Side path</div>
      </div>
    </div>

    <!-- Links: the web to the browser -->
    <div class="flow-edge flow-edge-v" style="grid-row: 2; grid-column: 4">
      <i class="flow-head flow-head-start"></i>
      <span class="flow-edge-label">sync</span>
      <i class="flow-head flow-head-end"></i>
    </div>
    <div class="flow-edge flow-edge-v flow-edge-side" style="grid-row: 2; grid-column: 6">
      <span class="flow-edge-label">CSV</span>
      <i class="flow-head flow-head-end"></i>
    </div>

    <!-- Band: your browser, drawn as a browser window -->
    <div class="flow-band" style="grid-row: 3">
      <span class="flow-band-name">Your browser</span>
      <span class="flow-band-sub">Your local copy and workspace</span>
    </div>
    <div class="flow-browser" style="grid-row: 3; grid-column: 2 / 7">
      <div class="flow-browser-bar">
        <i class="flow-browser-dot"></i>
        <i class="flow-browser-dot"></i>
        <i class="flow-browser-dot"></i>
        <span class="flow-browser-url">Sortify</span>
      </div>
      <div class="flow-browser-body">
        <div class="flow-label">Library and workspace</div>
        <div class="flow-desc">Stored in IndexedDB. Private, and every edit happens here.</div>
      </div>
    </div>

    <!-- Link: the browser to files -->
    <div class="flow-edge flow-edge-v" style="grid-row: 4; grid-column: 2 / 7">
      <i class="flow-head flow-head-start"></i>
      <span class="flow-edge-label">save / load</span>
      <i class="flow-head flow-head-end"></i>
    </div>

    <!-- Band: your files, drawn as a laptop holding them -->
    <div class="flow-band" style="grid-row: 5">
      <span class="flow-band-name">Your files</span>
      <span class="flow-band-sub">Reliable, compact, universal</span>
    </div>
    <div class="flow-machine" style="grid-row: 5; grid-column: 2 / 7">
      <svg class="flow-laptop" viewBox="0 0 160 92" aria-hidden="true">
        <rect x="14" y="2" width="132" height="78" rx="5" />
        <path d="M2 84h156l-6 6H8z" />
        <g class="flow-file">
          <path d="M44 18h22l8 8v36H44z" />
          <path d="M66 18v8h8" />
          <text x="59" y="48">CSV</text>
        </g>
        <g class="flow-file">
          <path d="M86 18h22l8 8v36H86z" />
          <path d="M108 18v8h8" />
          <text x="101" y="48">JSON</text>
        </g>
      </svg>
      <div class="flow-text">
        <div class="flow-label">Your computer</div>
        <div class="flow-desc">Backups you own. Open them on any device.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow {
  display: grid;
  grid-template-columns: 170px 1fr 40px 1.8fr 40px 1fr;
  max-width: 900px;
  grid-template-rows: auto 56px auto 56px auto;
  column-gap: 0;
}

/* Band names in the left margin */
.flow-band {
  grid-column: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding-right: var(--space-4);
}
.flow-band-name { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.flow-band-sub { font-size: var(--font-size-xs); color: var(--color-text-muted); }

/* Nodes */
.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  text-align: center;
}
.flow-node-row { flex-direction: row; gap: var(--space-3); text-align: left; white-space: nowrap; }
.flow-node-main { padding: var(--space-4) var(--space-5); border-color: var(--color-text-muted); }
.flow-node-optional { border-style: dashed; background: transparent; padding: var(--space-2) var(--space-3); align-self: center; }
.flow-node-optional .flow-label { font-size: var(--font-size-sm); }
.flow-node-optional .flow-icon { width: 26px; height: 26px; }
.flow-text { display: flex; flex-direction: column; gap: 2px; }
.flow-label { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.flow-link { text-decoration: none; }
.flow-link:hover { text-decoration: underline; }
.flow-desc { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: var(--line-height-normal); }

/* Line icons */
.flow-icon { width: 40px; height: 32px; flex-shrink: 0; }
.flow-icon,
.flow-laptop {
  fill: none;
  stroke: var(--color-text-muted);
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.flow-icon-fill { fill: var(--color-text-muted); stroke: none; }

/* Browser window */
.flow-browser {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
}
.flow-browser-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border-subtle);
}
.flow-browser-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--color-border-subtle); }
.flow-browser-url {
  flex: 1;
  max-width: 320px;
  margin: 0 auto;
  padding: 2px var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-bg);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
}
.flow-browser-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-5);
  text-align: center;
}

/* Laptop with files */
.flow-machine { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); text-align: center; }
.flow-laptop { width: 160px; height: 92px; flex-shrink: 0; }
.flow-file text {
  fill: var(--color-text);
  stroke: none;
  font-size: 9px;
  font-weight: 600;
  font-family: var(--font-family);
  text-anchor: middle;
}

/* Edges: a line, a label, and an arrowhead at each end that has one */
.flow-edge { position: relative; }
.flow-edge::before {
  content: '';
  position: absolute;
  background: var(--color-border-subtle);
}
.flow-edge-label {
  position: absolute;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}
.flow-head {
  position: absolute;
  width: 0;
  height: 0;
  border: 5px solid transparent;
}

/* A side path: a dashed line */
.flow-edge-side.flow-edge-h::before { background: repeating-linear-gradient(to right, var(--color-border-subtle) 0 5px, transparent 5px 9px); }
.flow-edge-side.flow-edge-v::before { background: repeating-linear-gradient(to bottom, var(--color-border-subtle) 0 5px, transparent 5px 9px); }
/* Exportify is shorter than Spotify and centered in its row, so its line reaches up to meet it */
.flow-edge-side.flow-edge-v { margin-top: -20px; }

/* Horizontal: start is left, end is right */
.flow-edge-h::before { left: 4px; right: 4px; top: 50%; height: 2px; margin-top: -1px; }
.flow-edge-h .flow-head { top: 50%; margin-top: -5px; }
.flow-edge-h .flow-head-end { right: 0; border-left: 8px solid var(--color-text-muted); border-right-width: 0; }
.flow-edge-h .flow-head-start { left: 0; border-right: 8px solid var(--color-text-muted); border-left-width: 0; }

/* Vertical: start is top, end is bottom */
.flow-edge-v::before { top: 4px; bottom: 4px; left: 50%; width: 2px; margin-left: -1px; }
.flow-edge-v .flow-edge-label { top: 50%; left: calc(50% + 10px); transform: translateY(-50%); }
.flow-edge-v .flow-head { left: 50%; margin-left: -5px; }
.flow-edge-v .flow-head-end { bottom: 0; border-top: 8px solid var(--color-text-muted); border-bottom-width: 0; }
.flow-edge-v .flow-head-start { top: 0; border-bottom: 8px solid var(--color-text-muted); border-top-width: 0; }
</style>
