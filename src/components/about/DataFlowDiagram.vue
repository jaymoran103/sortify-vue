<script setup lang="ts">
// Static 2x2 diagram: streaming services on the left, the user's device on the right.
// Top row is the live connection, bottom row is files.
</script>

<template>
  <div class="flow">
    <div class="flow-zone">Streaming services</div>
    <div></div>
    <div class="flow-zone">Your device</div>

    <!-- Row 1: provider <-> browser -->
    <div class="flow-node">
      <div class="flow-icon">⊙</div>
      <div class="flow-label">Providers</div>
      <div class="flow-chips">
        <span class="flow-chip">Spotify</span>
        <span class="flow-chip">Apple Music</span>
        <span class="flow-chip">others</span>
      </div>
      <div class="flow-desc">Where your library starts. Spotify connects directly.</div>
    </div>

    <div class="flow-edge flow-edge-h">
      <i class="flow-head flow-head-start"></i>
      <span class="flow-edge-label">sync (Spotify)</span>
      <i class="flow-head flow-head-end"></i>
    </div>

    <div class="flow-node flow-node-accent">
      <div class="flow-icon">⎈</div>
      <div class="flow-label">Your browser</div>
      <div class="flow-chips"><span class="flow-chip">IndexedDB</span></div>
      <div class="flow-desc">Your private working copy. Every edit happens here.</div>
    </div>

    <!-- Row 2: vertical links -->
    <div class="flow-edge flow-edge-v">
      <span class="flow-edge-label">optional</span>
      <i class="flow-head flow-head-end"></i>
    </div>
    <div></div>
    <div class="flow-edge flow-edge-v">
      <i class="flow-head flow-head-start"></i>
      <span class="flow-edge-label">import / export</span>
      <i class="flow-head flow-head-end"></i>
    </div>

    <!-- Row 3: exporter -> files -->
    <div class="flow-node flow-node-optional">
      <div class="flow-icon">⇩</div>
      <div class="flow-label">Exporters</div>
      <div class="flow-chips">
        <span class="flow-chip">Exportify</span>
        <span class="flow-chip">TuneMyMusic</span>
      </div>
      <div class="flow-desc">Free tools that save any provider's playlists as CSV.</div>
    </div>

    <div class="flow-edge flow-edge-h">
      <span class="flow-edge-label">CSV</span>
      <i class="flow-head flow-head-end"></i>
    </div>

    <div class="flow-node">
      <div class="flow-icon">☰</div>
      <div class="flow-label">Your files</div>
      <div class="flow-chips">
        <span class="flow-chip">CSV</span>
        <span class="flow-chip">JSON</span>
      </div>
      <div class="flow-desc">Backups you own. Re-import on any device.</div>
    </div>
  </div>
</template>

<style scoped>
.flow {
  display: grid;
  grid-template-columns: 1fr 140px 1fr;
  grid-template-rows: auto auto 64px auto;
  max-width: 820px;
  margin: 0 auto;
}

/* Zone captions over each column */
.flow-zone {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  text-align: center;
  padding-bottom: var(--space-3);
}

/* Nodes */
.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  text-align: center;
}
.flow-node-accent {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
}
.flow-node-optional { border-style: dashed; }
.flow-icon { font-size: 1.5rem; line-height: 1; color: var(--color-text-muted); }
.flow-label { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.flow-desc { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: var(--line-height-normal); }
.flow-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-1); }
.flow-chip {
  font-size: var(--font-size-xs);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
  color: var(--color-text);
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

/* Horizontal: start is left, end is right */
.flow-edge-h::before { left: 4px; right: 4px; top: 50%; height: 2px; margin-top: -1px; }
.flow-edge-h .flow-edge-label { left: 0; right: 0; bottom: calc(50% + 6px); text-align: center; }
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
