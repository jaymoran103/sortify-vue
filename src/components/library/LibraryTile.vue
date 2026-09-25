<script setup lang="ts">
// One art-forward card in a library row. Deliberately kind-agnostic: a folder and a playlist
// differ only in the cover treatment and what a click means, so both render through this
// rather than through two near-identical components. The parent decides what `open` does.
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  subtitle: string
  kind: 'folder' | 'playlist'
  imageUrl?: string
  /** Name of the canonical home when this card is borrowed into the folder showing it. */
  borrowedFrom?: string | null
  selected?: boolean
}>(), {
  imageUrl: undefined,
  borrowedFrom: null,
  selected: false,
})

const emit = defineEmits<{
  open: [event: MouseEvent]
  menu: [event: MouseEvent]
}>()

// Spotify CDN URLs expire, and a broken-image glyph in an art-forward row is very visible,
// so a failed load falls back to the generated tile. Reset when the URL itself changes.
const imageFailed = ref(false)
watch(() => props.imageUrl, () => (imageFailed.value = false))
const showImage = computed(() => props.kind === 'playlist' && !!props.imageUrl && !imageFailed.value)

// Stable pseudo-random hue from the name, so a card keeps its colour across reloads and the
// row never has a hole where art is missing.
const hue = computed(() => {
  let hash = 0
  for (let i = 0; i < props.title.length; i++) {
    hash = (hash * 31 + props.title.charCodeAt(i)) % 360
  }
  return hash
})

const initials = computed(() =>
  props.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join(''),
)
</script>

<template>
  <button
    class="tile no-text-select"
    :class="[`tile--${kind}`, { 'tile--selected': selected, 'tile--borrowed': borrowedFrom }]"
    :title="title"
    :aria-pressed="kind === 'playlist' ? selected : undefined"
    @click="emit('open', $event)"
    @contextmenu="emit('menu', $event)"
  >
    <span class="tile__cover" :style="{ '--tile-hue': hue }" aria-hidden="true">
      <img v-if="showImage" class="tile__image" :src="imageUrl" alt="" @error="imageFailed = true" />
      <svg v-else-if="kind === 'folder'" class="tile__folder-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h5.2c.5 0 .97.25 1.25.67l.9 1.33H20.5A1.5 1.5 0 0 1 22 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5v-13Z" />
      </svg>
      <span v-else class="tile__initials">{{ initials }}</span>

      <span v-if="borrowedFrom" class="tile__borrowed" :title="`Lives in ${borrowedFrom}`">
        ↩ {{ borrowedFrom }}
      </span>
      <span v-if="selected" class="tile__check">✓</span>
    </span>

    <span class="tile__text">
      <span class="tile__title">{{ title }}</span>
      <span class="tile__subtitle text-muted">{{ subtitle }}</span>
    </span>

    <span
      class="tile__menu"
      role="presentation"
      title="More"
      @click.stop="emit('menu', $event as MouseEvent)"
    >
      ⋯
    </span>
  </button>
</template>

<style scoped>
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default),
    background var(--duration-fast) var(--ease-default);
}

.tile:hover {
  border-color: var(--color-accent);
  background: var(--color-surface-raised);
}

.tile:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.tile--selected {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
}

/* A borrowed card never renders identically to a canonical one. */
.tile--borrowed {
  border-style: dashed;
}

.tile__cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: hsl(var(--tile-hue) 30% 28%);
  color: hsl(var(--tile-hue) 60% 82%);
}

/* Folders read as a container, not an item: squarer, and stacked behind a lip. */
.tile--folder .tile__cover {
  overflow: visible;
  border-radius: var(--radius-sm);
  box-shadow: 4px -4px 0 -1px var(--color-surface), 4px -4px 0 var(--color-border-subtle);
}

.tile__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tile__initials {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.tile__folder-icon {
  width: 40%;
  height: 40%;
}

.tile__borrowed {
  position: absolute;
  left: var(--space-1);
  bottom: var(--space-1);
  max-width: calc(100% - 2 * var(--space-1));
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__check {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-text-on-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.tile__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-right: var(--space-4);
}

.tile__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__subtitle {
  font-size: var(--font-size-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Revealed on hover so a resting row stays quiet. Right-click reaches the same menu. */
.tile__menu {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  padding: 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  line-height: 1;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-default);
}

.tile:hover .tile__menu,
.tile:focus-within .tile__menu {
  opacity: 1;
}

.tile__menu:hover {
  color: var(--color-text);
}
</style>
