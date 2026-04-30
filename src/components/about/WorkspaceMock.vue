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

//Set a time for the save timestamp display. Inessential but feels like a nice touch
const timeOnLoad = new Date().toLocaleTimeString()

</script>


<template>

<!-- Header Section -->

<!-- Tab 0: Emphasize Save Button -->
  <div class="ws-header">
    <span class="ws-title">Blues Session</span>
    <span class="ws-meta">{{ playlists.length }} playlists · {{ tracks.length }} tracks</span>
    <div class="ws-header-actions">
      <span v-if="activeTab === 0" class="ws-unsaved">Unsaved changes</span>
      <span v-else class="ws-unsaved">Saved at {{ timeOnLoad }}</span>

      <button class="ws-btn" :class="activeTab === 0 ? 'ws-btn-primary' : 'ws-btn-disabled'">Save</button>
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
        <span>{{ pl }} <span class="ws-col-menu" :style="activeTab !== 1 ? 'visibility: hidden' : ''"></span></span>
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
        <span v-if="activeTab !== 1" :class="['ws-checkbox', checked && 'ws-checked']">{{ checked ? '✓' : '' }}</span>
        <span v-else :class="['ws-checkbox', 'ws-muted', checked && 'ws-checked-muted']">{{ checked ? '✓' : '' }}</span>
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

    <!-- Tab 2: Export modal overlay -->
  <div v-if="activeTab === 2" class="ws-modal-overlay">
    <div class="ws-modal">
      <div class="ws-modal-title">Export</div>
      <p class="ws-modal-sub">Where are you exporting to?</p>
      <div class="ws-source-grid">

        <button class="ws-source-card">
          <span class="ws-source-label">Spotify</span>
          <span class="ws-source-hint">Send to your library</span>
        </button>

        <button class="ws-source-card">
          <span class="ws-source-label">CSV</span>
          <span class="ws-source-hint">One file per playlist</span>
        </button>

        <button class="ws-source-card">
          <span class="ws-source-label">JSON</span>
          <span class="ws-source-hint">All playlists in one file</span>
        </button>
        
      </div>
    </div>
  </div>
</template>


<style scoped>
/* FUTURE: Borrow more styling explictly from workspace/modal components? Better to leave independent here? */
@import './mock-shared.css';
.ws-row { 
    grid-template-columns: 40px minmax(160px, 1fr) repeat(4, minmax(90px, 130px)); 
}

.ws-idx {
  position: relative;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
/* TODO: Tentative feature, planning to add to workspace along with direct play */
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

.ws-pl-col {
  justify-content: center;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.ws-col-menu { 
    opacity: 0.5; 
    font-size: 10px; 
    margin-left: 2px;
 }
.ws-unsaved { 
    font-size: var(--font-size-xs); 
    color: var(--color-text-muted); 
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

.ws-modal-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-bg) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}
.ws-modal {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  width: 320px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.ws-modal-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
.ws-modal-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}
.ws-source-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}
.ws-source-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: center;
}
.ws-source-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}
.ws-source-hint {
  font-size: 10px;
  color: var(--color-text-muted);
}
</style>
