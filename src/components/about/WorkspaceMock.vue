<script setup lang="ts">
defineProps<{ activeTab: number }>()

const playlists = ['Blues Rock', 'Classic Blues', 'Blues Covers', 'Best Riffs']

const tracks = [
  { title: 'The Thrill is Gone',    artist: 'B.B. King',          cols: [false, true,  false, false] },
  { title: 'Boom Boom',             artist: 'John Lee Hooker',    cols: [false, true,  false, true ] },
  { title: 'Born Under a Bad Sign', artist: 'Albert King',        cols: [false, true,  false, false] },
  { title: 'Born Under a Bad Sign', artist: 'Jimi Hendrix',       cols: [true,  false, true,  false] },
  { title: 'Hey Joe',               artist: 'Jimi Hendrix',       cols: [true,  false, true,  true ] },
  { title: 'Pride and Joy',         artist: 'Stevie Ray Vaughan', cols: [true,  false, false, true ] },
  { title: 'La Grange',             artist: 'ZZ Top',             cols: [true,  false, false, true ] },
]
</script>

<template>

<!-- Header Section -->

<!-- Tab 2: Emphasize Save Button -->
  <div class="ws-header">
    <span class="ws-title">Blues Session</span>
    <span class="ws-meta">{{ playlists.length }} playlists · {{ tracks.length }} tracks</span>
    <div class="ws-header-actions">
      <span v-if="activeTab === 2" class="ws-unsaved">Unsaved changes</span>
      <button class="ws-btn" :class="activeTab === 2 ? 'ws-btn-primary' : 'ws-btn-disabled'">Save</button>
    </div>
  </div>

  <!-- Table Display -->
   <!-- Tab 1: Display playlist menu over columns -->
  <div class="ws-table">
    <div class="ws-row ws-row-head">
      <div class="ws-cell ws-idx">#</div>
      <div class="ws-cell ws-track-col">Track</div>

      <!-- For each playlist, display a column -->
      <div v-for="pl in playlists" :key="pl" class="ws-cell ws-pl-col">
        <span v-if="activeTab === 1">{{ pl }} <span class="ws-col-menu"></span></span>
        <span v-else>{{ pl }}</span>
      </div>
    </div>

    <!-- Track rows -->
     <!-- Tab 1: Render checkboxes as disabled (emphasizes context menu) -->

     <!-- For each track, display a row with metadata and checkboxes for each playlist-->
    <div
      v-for="(track, ti) in tracks"
      :key="track.title + track.artist"
      class="ws-row"
    >
      <div class="ws-cell ws-idx">{{ ti + 1 }}</div>
      <div class="ws-cell ws-track-col">
        <span class="ws-track-title">{{ track.title }}</span>
        <span class="ws-track-artist">{{ track.artist }}</span>
      </div>

      <!-- For each playlist, display a checkbox
       case 0,2: default checkboxes 
       case 1: disabled checkboxes with muted styling, emphasizes column menu 
       -->
      <div v-for="(checked, ci) in track.cols" :key="ci" class="ws-cell ws-pl-col">
        <span v-if="activeTab === 0 || activeTab === 2" :class="['ws-checkbox', checked && 'ws-checked']">{{ checked ? '✓' : '' }}</span>
        <span v-else-if="activeTab === 1"  :class="['ws-checkbox', 'ws-muted', checked && 'ws-checked-muted']">{{ checked ? '✓' : '' }}</span>
      </div>
    </div>
  </div>

  <!-- Tab 1: Display column dropdown -->
  <div v-if="activeTab === 1" class="ws-col-dropdown">
    <div class="ws-dropdown-title">Blues Covers <span class="ws-meta">23 tracks</span></div>
    <div class="ws-dropdown-item">Rename</div>
    <div class="ws-dropdown-item">Duplicate</div>
    <div class="ws-dropdown-item">Add All</div>
    <div class="ws-dropdown-item">Remove All</div>
    <div class="ws-dropdown-item ws-dropdown-danger">Remove from session</div>
  </div>

    <!-- Tab 2: Display export panel at bottom-->
  <div v-if="activeTab === 2" class="ws-export-panel">
    <div class="ws-export-row">
      <span class="ws-unsaved-badge">3 unsaved changes</span>
      <button class="ws-btn ws-btn-primary">Save to Library</button>
    </div>
    <div class="ws-export-option">
      <strong>CSV</strong>
      <span>One file per playlist. Opens in any spreadsheet app.</span>
      <button class="ws-btn ws-btn-ghost">Export</button>
    </div>
    <div class="ws-export-option">
      <strong>JSON</strong>
      <span>Full bundle. Re-import into Sortify on any device.</span>
      <button class="ws-btn ws-btn-ghost">Export</button>
    </div>
  </div>
</template>

<style scoped>

.ws-title { 
    font-weight: var(--font-weight-semibold); 
    color: var(--color-text); 
}
.ws-meta { 
    font-size: var(--font-size-xs); 
    color: var(--color-text-muted); 
    flex: 1; 
}
.ws-header-actions { 
    display: flex; 
    align-items: center; 
    gap: var(--space-2); 
}
.ws-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
}
.ws-row { grid-template-columns: 40px minmax(160px, 1fr) repeat(4, minmax(90px, 130px)); }


.ws-table { 
    display: flex; 
    flex-direction: column; 
}
.ws-row { 
    display: grid; 
    border-bottom: 1px solid var(--color-border-subtle); 
}
.ws-row:hover:not(.ws-row-head) { 
    background: var(--color-row-hover);
 }
.ws-row-head { 
    background: var(--color-surface-raised); 
    position: sticky; 
    top: 0; 
}
.ws-cell { 
    padding: var(--space-2) var(--space-3); 
    display: flex; align-items: center; }
.ws-idx {
  position: relative;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.ws-idx::after {
  content: '▶';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
  color: var(--color-text-muted);
}
.ws-row:hover:not(.ws-row-head) .ws-idx { color: transparent; }
.ws-row:hover:not(.ws-row-head) .ws-idx::after { opacity: 1; }

.ws-track-col { flex-direction: column; align-items: flex-start; gap: 2px; }
.ws-track-title { color: var(--color-text); font-size: var(--font-size-sm); }
.ws-track-artist { color: var(--color-text-muted); font-size: var(--font-size-xs); }


.ws-checked { background: var(--color-accent); border-color: var(--color-accent); }
.ws-muted { opacity: 0.4; }
.ws-checked-muted { background: var(--color-accent); border-color: var(--color-accent); opacity: 0.4; }

.ws-pl-col {
  justify-content: center;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.ws-col-menu { opacity: 0.5; font-size: 10px; margin-left: 2px; }
.ws-unsaved { font-size: var(--font-size-xs); color: var(--color-text-muted); }



.ws-btn {
  padding: 3px var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-xs);
  cursor: default;
  background: var(--color-surface-raised);
  color: var(--color-text);
}
.ws-btn-primary { 
    background: var(--color-accent); 
    color: var(--color-text-on-accent); 
    border-color: var(--color-accent); 
    cursor: pointer; 
}
.ws-btn-ghost { 
    background: transparent; 
    color: var(--color-text-muted); 
    cursor: pointer; 
}
.ws-btn-disabled { 
    opacity: 0.4; 
}

.ws-checkbox {
  width: 15px; height: 15px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; color: var(--color-text-on-accent);
}


.ws-col-dropdown {
  position: absolute;
  top: 68px;
  right: 100px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  font-size: var(--font-size-sm);
  min-width: 180px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  z-index: 5;
}
.ws-dropdown-title {
  padding: var(--space-2) var(--space-3);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-subtle);
  margin-bottom: var(--space-1);
}
.ws-dropdown-item {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: default;
}
.ws-dropdown-item:hover { background: var(--color-surface); color: var(--color-text); }
.ws-dropdown-danger { color: var(--color-danger); }



.ws-export-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: var(--color-surface-raised);
  border-top: 1px solid var(--color-border-subtle);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.ws-export-row { display: flex; align-items: center; gap: var(--space-3); }
.ws-unsaved-badge {
  font-size: var(--font-size-xs);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  color: var(--color-accent-hover);
  border: 1px solid var(--color-accent);
}
.ws-export-option {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
}
.ws-export-option strong { color: var(--color-text); min-width: 36px; }
.ws-export-option span { flex: 1; color: var(--color-text-muted); }












</style>
