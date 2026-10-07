<script setup lang="ts">
import { initials } from '@/utils/initials'

defineProps<{ activeTab: number }>()

// Columns are collapsed, as the workspace opens: one square tile wide, headed by initials.
const playlists = ['Blues Rock', 'Classic Blues', 'Blues Covers', 'Guitar Riffs']

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

      <!-- For each playlist, a collapsed column headed by its initials -->
      <div
        v-for="(pl, ci) in playlists"
        :key="pl"
        class="ws-cell ws-pl-col ws-tile-head"
        :class="{ 'ws-tile-head-open': activeTab === 1 && ci === 2 }"
        :title="pl"
      >{{ initials(pl) }}</div>
      <div class="ws-tile-edge"></div>
    </div>

    <!-- Track rows: the whole cell is the checkbox. Accent when checked, background when not. -->
    <!-- Tab 1: tiles dim, which puts the column menu forward -->
    <div
      v-for="(track, ti) in tracks"
      :key="track.title + track.artist"
      class="ws-row ws-tile-row"
      :class="{ 'ws-tiles-muted': activeTab === 1 }"
    >
      <div class="ws-cell ws-idx">{{ ti + 1 }}</div>
      <div class="ws-cell ws-track-col">
        <span class="ws-track-title">{{ track.title }}</span>
        <span class="ws-track-artist">{{ track.artist }}</span>
      </div>
      <div v-for="(checked, ci) in track.cols" :key="ci" class="ws-tile" :class="{ 'ws-tile-on': checked }"></div>
      <div class="ws-tile-edge"></div>
    </div>
  </div>

  <!-- Tab 1: Display column dropdown -->
  <div v-if="activeTab === 1" class="ws-menu ws-col-dropdown">
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
    grid-template-columns: 40px minmax(160px, 1fr) repeat(4, 48px) 2px; 
}

/* Square tiles, as in the workspace: a 48px row with a 2px border leaves a 46px cell, and
   each column's 2px left line leaves it 46px wide. */
.ws-tile-row { height: 48px; border-bottom-width: 2px; grid-template-rows: 46px; }
.ws-tile-row .ws-cell { padding-block: 0; }
.ws-tile,
.ws-tile-head,
.ws-tile-edge { border-left: 2px solid var(--color-border-subtle); align-self: stretch; }
.ws-tile-on { background: var(--color-accent); }
.ws-tiles-muted .ws-tile { opacity: 0.4; }
.ws-tile-head { padding: 0; font-size: var(--font-size-xs); }
.ws-tile-head-open { color: var(--color-text); background: var(--color-surface); }

.ws-col-dropdown {
  position: absolute;
  top: 84px;
  right: 54px;
}

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
