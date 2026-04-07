<script setup lang="ts">
/**
 * PROTOTYPE C — Spotify Card (stubbed)
 * Displays connection status and disabled sync buttons.
 * Shows what a dedicated Spotify card could look like.
 *
 * STATUS: UI prototype only — no data layer integration.
 */
</script>

<template>
  <div class="dashboard-card proto-spotify-card">
    <div class="proto-label">C — Spotify</div>
    <div class="dashboard-card__header">
      <h2 class="dashboard-card__title">Spotify</h2>
    </div>

    <!-- Connection status -->
    <div class="proto-conn">
      <span class="proto-conn__dot" />
      <span class="text-sm text-muted">Not connected</span>
    </div>

    <button class="btn btn--spotify" disabled>
      Connect to Spotify
    </button>

    <!-- Stubbed sync actions -->
    <div class="proto-sync-actions">
      <button class="btn btn--secondary" disabled>Pull Playlists</button>
      <button class="btn btn--secondary" disabled>Push Changes</button>
    </div>

    <p class="text-xs text-muted proto-last-sync">Last sync: never</p>
  </div>
</template>

<style scoped>
@import '../card.css';

.proto-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
  margin-bottom: calc(-1 * var(--space-2));
}

.proto-spotify-card {
  border-color: var(--gray-600);
}

.proto-conn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.proto-conn__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--gray-500);
  flex-shrink: 0;
}

.btn--spotify {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: #1db954;
  color: #000;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}
.btn--spotify:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.proto-sync-actions {
  display: flex;
  gap: var(--space-3);
}

.proto-last-sync {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-subtle);
}
</style>
