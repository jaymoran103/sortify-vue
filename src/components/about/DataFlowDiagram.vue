<script setup lang="ts">
// Where your music lives, as three bands: the web, your browser, your files.
// Spotify syncs straight down and back. Apple Music reaches the browser only through an exporter.
// The browser saves to and loads from files.
</script>

<template>
  <div class="flow">
    <!-- Band: the web -->
    <div class="flow-band" style="grid-row: 1">
      <span class="flow-band-name">The web</span>
      <span class="flow-band-sub">Music providers and exporters</span>
    </div>

    <div class="flow-node" style="grid-row: 1; grid-column: 2">
      <div class="flow-label">Spotify</div>
      <div class="flow-desc">Syncs both ways</div>
    </div>
    <div class="flow-edge flow-edge-h" style="grid-row: 1; grid-column: 3">
      <i class="flow-head flow-head-end"></i>
    </div>
    <div class="flow-node flow-node-optional" style="grid-row: 1; grid-column: 4">
      <div class="flow-label">Exportify</div>
      <div class="flow-desc">Optional</div>
    </div>
    <div class="flow-node flow-node-optional flow-gap-left" style="grid-row: 1; grid-column: 5">
      <div class="flow-label">TuneMyMusic</div>
      <div class="flow-desc">Optional</div>
    </div>
    <div class="flow-edge flow-edge-h" style="grid-row: 1; grid-column: 6">
      <i class="flow-head flow-head-start"></i>
    </div>
    <div class="flow-node" style="grid-row: 1; grid-column: 7">
      <div class="flow-label">Apple Music</div>
      <div class="flow-desc">Through an exporter</div>
    </div>

    <!-- Links: the web to the browser -->
    <div class="flow-edge flow-edge-v" style="grid-row: 2; grid-column: 2">
      <i class="flow-head flow-head-start"></i>
      <span class="flow-edge-label">sync</span>
      <i class="flow-head flow-head-end"></i>
    </div>
    <div class="flow-edge flow-edge-v" style="grid-row: 2; grid-column: 4">
      <span class="flow-edge-label">CSV</span>
      <i class="flow-head flow-head-end"></i>
    </div>
    <div class="flow-edge flow-edge-v flow-gap-left" style="grid-row: 2; grid-column: 5">
      <span class="flow-edge-label">CSV</span>
      <i class="flow-head flow-head-end"></i>
    </div>

    <!-- Band: your browser -->
    <div class="flow-band" style="grid-row: 3">
      <span class="flow-band-name">Your browser</span>
      <span class="flow-band-sub">Your local copy and workspace</span>
    </div>
    <div class="flow-node flow-node-accent flow-node-wide" style="grid-row: 3; grid-column: 2 / 8">
      <div class="flow-label">Library and workspace</div>
      <div class="flow-desc">Stored in IndexedDB. Private, and every edit happens here.</div>
    </div>

    <!-- Link: the browser to files -->
    <div class="flow-edge flow-edge-v" style="grid-row: 4; grid-column: 4 / 6">
      <i class="flow-head flow-head-start"></i>
      <span class="flow-edge-label">save / load</span>
      <i class="flow-head flow-head-end"></i>
    </div>

    <!-- Band: your files -->
    <div class="flow-band" style="grid-row: 5">
      <span class="flow-band-name">Your files</span>
      <span class="flow-band-sub">Reliable, compact, universal</span>
    </div>
    <div class="flow-node" style="grid-row: 5; grid-column: 4 / 6">
      <div class="flow-label">CSV and JSON</div>
      <div class="flow-desc">Backups you own. Open on any device.</div>
    </div>
  </div>
</template>

<style scoped>
.flow {
  display: grid;
  grid-template-columns: 170px 1.3fr 36px 1fr 1fr 36px 1.3fr;
  grid-template-rows: auto 56px auto 56px auto;
  column-gap: 0;
}
/* A little air between the two exporters */
.flow-gap-left { margin-left: var(--space-3); }

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
.flow-node-accent {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
}
.flow-node-wide { padding: var(--space-5); }
.flow-node-optional { border-style: dashed; background: transparent; }
.flow-label { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.flow-desc { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: var(--line-height-normal); }

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
