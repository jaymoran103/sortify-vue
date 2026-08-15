<script setup lang="ts">
import { computed } from 'vue'
import type { EquivalenceGroup, MatchTier, Playlist, Track } from '@/types/models'

const props = defineProps<{
  group: EquivalenceGroup
  tracks: Map<string, Track>
  playlists: Playlist[]
  position: { index: number; total: number }
}>()

const emit = defineEmits<{
  prefer: [trackId: string]
  confirm: []
  reject: []
  consolidate: []
  approveAll: []
  rescan: []
  next: []
  close: []
}>()

/** The variant rows, in stored order, joined with whatever the track table knows about them. */
const variants = computed(() =>
  props.group.trackIds.map((trackId) => ({
    trackId,
    track: props.tracks.get(trackId),
    isPreferred: trackId === preferredId.value,
  })),
)

/** Falls back to the first variant so a group always displays something as the one to keep. */
const preferredId = computed(() => props.group.preferredTrackId ?? props.group.trackIds[0])

/** Only the playlists that actually hold one of these variants become matrix columns. */
const relevantPlaylists = computed(() =>
  props.playlists.filter((playlist) =>
    props.group.trackIds.some((trackId) => playlist.trackIDs.includes(trackId)),
  ),
)

const title = computed(() => props.tracks.get(preferredId.value ?? '')?.title ?? 'Doubles group')

/**
 * The tier shown per row. The preferred variant is the anchor everything else is measured
 * against, so it reads as Source rather than repeating the group's own confidence back at itself.
 */
function tierFor(isPreferred: boolean): MatchTier {
  return isPreferred ? 'source' : props.group.matchTier
}

function tierLabel(tier: MatchTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}
</script>

<template>
  <section class="doubles-panel">
    <header class="doubles-panel__header">
      <div class="doubles-panel__heading">
        <span class="doubles-panel__title">Doubles: <strong>{{ title }}</strong></span>
        <span class="text-muted text-sm">
          {{ group.trackIds.length }} versions · {{ relevantPlaylists.length }} playlists ·
          group {{ position.index + 1 }} of {{ position.total }}
        </span>
      </div>

      <div class="doubles-panel__header-actions">
        <button class="doubles-panel__confirm btn btn--primary btn--sm" @click="emit('confirm')">
          Mark Resolved
        </button>
        <button class="doubles-panel__reject btn btn--secondary btn--sm" @click="emit('reject')">
          Not doubles
        </button>
        <button class="doubles-panel__next btn btn--secondary btn--sm" @click="emit('next')">
          Next Set
        </button>
        <button class="doubles-panel__close btn btn--ghost btn--sm" @click="emit('close')">
          Close
        </button>
      </div>
    </header>

    <div class="doubles-panel__table">
      <div class="doubles-panel__row doubles-panel__row--head">
        <div class="doubles-panel__cell doubles-panel__cell--index">#</div>
        <div class="doubles-panel__cell doubles-panel__cell--track">Title / Artist</div>
        <div class="doubles-panel__cell doubles-panel__cell--album">Album</div>
        <div
          v-for="playlist in relevantPlaylists"
          :key="playlist.id"
          class="doubles-panel__cell doubles-panel__cell--playlist"
          :title="playlist.name"
        >
          {{ playlist.name }}
        </div>
        <div class="doubles-panel__cell doubles-panel__cell--tier">Match</div>
        <div class="doubles-panel__cell doubles-panel__cell--action"></div>
      </div>

      <div
        v-for="(variant, index) in variants"
        :key="variant.trackId"
        class="doubles-panel__row"
        :class="{ 'doubles-panel__row--preferred': variant.isPreferred }"
      >
        <div class="doubles-panel__cell doubles-panel__cell--index">{{ index + 1 }}</div>

        <div class="doubles-panel__cell doubles-panel__cell--track">
          <span class="doubles-panel__track-title">{{ variant.track?.title ?? variant.trackId }}</span>
          <span class="doubles-panel__track-artist text-muted text-xs">
            {{ variant.track?.artist ?? 'Unknown artist' }}
          </span>
        </div>

        <div class="doubles-panel__cell doubles-panel__cell--album text-muted text-xs">
          {{ variant.track?.album }}
        </div>

        <!-- Read-only: this answers "which playlists is this variant in", which is the question a
             reviewer asks. Editing membership belongs to the workspace. -->
        <div
          v-for="playlist in relevantPlaylists"
          :key="playlist.id"
          class="doubles-panel__cell doubles-panel__cell--playlist"
        >
          <span
            class="doubles-panel__mark"
            :class="{ 'doubles-panel__mark--on': playlist.trackIDs.includes(variant.trackId) }"
          >
            {{ playlist.trackIDs.includes(variant.trackId) ? '✓' : '' }}
          </span>
        </div>

        <div class="doubles-panel__cell doubles-panel__cell--tier">
          <span class="doubles-panel__tier" :class="`doubles-panel__tier--${tierFor(variant.isPreferred)}`">
            {{ tierLabel(tierFor(variant.isPreferred)) }}
          </span>
        </div>

        <div class="doubles-panel__cell doubles-panel__cell--action">
          <span v-if="variant.isPreferred" class="doubles-panel__keep-badge">Keep</span>
          <button
            v-else
            class="doubles-panel__prefer btn btn--ghost btn--sm"
            @click="emit('prefer', variant.trackId)"
          >
            Prefer
          </button>
        </div>
      </div>
    </div>

    <footer class="doubles-panel__footer">
      <button class="doubles-panel__consolidate btn btn--danger btn--sm" @click="emit('consolidate')">
        Consolidate
      </button>
      <button class="doubles-panel__approve-all btn btn--secondary btn--sm" @click="emit('approveAll')">
        Approve All
      </button>
      <button class="doubles-panel__rescan btn btn--secondary btn--sm" @click="emit('rescan')">
        Re-scan
      </button>
    </footer>
  </section>
</template>

<style scoped>
.doubles-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface);
}

.doubles-panel__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
}

.doubles-panel__heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.doubles-panel__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doubles-panel__header-actions {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}

.doubles-panel__table {
  display: flex;
  flex-direction: column;
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.doubles-panel__row {
  display: grid;
  grid-template-columns:
    28px minmax(140px, 1.4fr) minmax(100px, 1fr)
    repeat(v-bind('relevantPlaylists.length'), minmax(60px, 80px))
    72px 90px;
  align-items: center;
  gap: var(--space-1);
  min-height: 44px;
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-sm);
}

.doubles-panel__row--head {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  min-height: 32px;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.doubles-panel__row--preferred {
  background: var(--color-accent-subtle);
}

.doubles-panel__cell {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.doubles-panel__cell--index {
  justify-content: center;
  color: var(--color-text-muted);
}

.doubles-panel__cell--track {
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}

.doubles-panel__cell--playlist,
.doubles-panel__cell--tier {
  justify-content: center;
}

.doubles-panel__cell--playlist {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.doubles-panel__cell--action {
  justify-content: flex-end;
}

.doubles-panel__track-title,
.doubles-panel__track-artist,
.doubles-panel__cell--album {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doubles-panel__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text-on-accent);
}

.doubles-panel__mark--on {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

/* Tier badges, ported from the About page mock so the shipped view matches the promise. */
.doubles-panel__tier {
  padding: 1px var(--space-2);
  border: 1px solid;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.doubles-panel__tier--source {
  color: var(--color-text-on-accent);
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.doubles-panel__tier--high {
  color: var(--color-accent-hover);
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
}

.doubles-panel__tier--moderate {
  color: #c99227;
  border-color: #b07a18;
  background: color-mix(in srgb, #c09030 12%, transparent);
}

.doubles-panel__tier--low {
  color: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
  background: color-mix(in srgb, var(--color-danger-hover) 12%, transparent);
}

.doubles-panel__keep-badge {
  padding: 1px var(--space-2);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-full);
  background: var(--color-accent-subtle);
  color: var(--color-accent-hover);
  font-size: var(--font-size-xs);
}

.doubles-panel__footer {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
}
</style>
