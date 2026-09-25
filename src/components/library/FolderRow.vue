<script setup lang="ts">
// One titled library row: a header over a single sideways-scrolling strip of cards.
//
// Owns layout only. What the cards are, what the counts mean and what each control does all
// belong to LibraryView, which has already resolved them (a presentational component does not
// reconstruct state its parent owns). The strip is plain flexbox rather than ScrollableList:
// that component is vertical-only, and a row holds tens of cards, not thousands.
const props = withDefaults(defineProps<{
  title: string
  canonicalCount: number
  borrowedCount?: number
  folderCount?: number
  /** Hidden to its header. The chevron's state. */
  collapsed?: boolean
  /** Strip swapped for a wrapping grid, in place. */
  expanded?: boolean
  /** Only the borrowed cards are showing. */
  borrowedOnly?: boolean
  /** Header links into a full-page view of this folder. False for derived rows like Unfiled. */
  openable?: boolean
  /** Shows the header menu button. */
  hasMenu?: boolean
  /** Tooltip on the borrowed figure, naming where those cards live. */
  overlapMessage?: string
  /** True when the row has nothing to show; renders the #empty slot instead of the strip. */
  empty?: boolean
}>(), {
  borrowedCount: 0,
  folderCount: 0,
  collapsed: false,
  expanded: false,
  borrowedOnly: false,
  openable: false,
  hasMenu: false,
  overlapMessage: '',
  empty: false,
})

const emit = defineEmits<{
  toggle: []
  expand: []
  drill: []
  filterBorrowed: []
  menu: [event: MouseEvent]
}>()

defineSlots<{
  default?(): unknown
  empty?(): unknown
}>()

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
</script>

<template>
  <section class="folder-row" :class="{ 'folder-row--collapsed': props.collapsed }">
    <header class="folder-row__header" @contextmenu="props.hasMenu && emit('menu', $event)">
      <button
        class="folder-row__chevron"
        :class="{ 'folder-row__chevron--collapsed': props.collapsed }"
        :aria-expanded="!props.collapsed"
        :title="props.collapsed ? 'Show row' : 'Hide row'"
        @click="emit('toggle')"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <button v-if="props.openable" class="folder-row__title folder-row__title--link" @click="emit('drill')">
        {{ props.title }}
      </button>
      <h2 v-else class="folder-row__title">{{ props.title }}</h2>

      <span class="folder-row__count text-muted text-sm">
        <template v-if="props.folderCount > 0">{{ pluralize(props.folderCount, 'folder') }} · </template>
        {{ pluralize(props.canonicalCount, 'playlist') }}
      </span>

      <!-- The overlap mark. The count stops lying about the total and becomes the explanation. -->
      <button
        v-if="props.borrowedCount > 0"
        class="folder-row__borrowed"
        :class="{ 'folder-row__borrowed--active': props.borrowedOnly }"
        :title="props.overlapMessage"
        @click="emit('filterBorrowed')"
      >
        + {{ props.borrowedCount }} borrowed
      </button>

      <span class="folder-row__spacer" />

      <button
        v-if="!props.collapsed && !props.empty"
        class="btn btn--ghost btn--sm"
        @click="emit('expand')"
      >
        {{ props.expanded ? 'Show less' : 'Show all' }}
      </button>
      <button v-if="props.openable" class="btn btn--ghost btn--sm" @click="emit('drill')">Open →</button>
      <button
        v-if="props.hasMenu"
        class="folder-row__menu"
        title="Folder actions"
        @click.stop="emit('menu', $event)"
      >
        ⋯
      </button>
    </header>

    <template v-if="!props.collapsed">
      <div v-if="props.empty" class="folder-row__empty">
        <slot name="empty" />
      </div>
      <div
        v-else
        class="folder-row__cards no-text-select"
        :class="props.expanded ? 'folder-row__cards--grid' : 'folder-row__cards--strip'"
      >
        <slot />
      </div>
    </template>
  </section>
</template>

<style scoped>
/* Rows are divided by a rule, not only by whitespace, so it stays clear which cards belong
   to which header. */
.folder-row {
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border);
}

.folder-row--collapsed {
  padding-bottom: var(--space-2);
}

.folder-row__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.folder-row--collapsed .folder-row__header {
  margin-bottom: var(--space-2);
}

.folder-row__chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: transform var(--duration-fast) var(--ease-default);
}

.folder-row__chevron:hover {
  color: var(--color-text);
  background: var(--color-surface-raised);
}

.folder-row__chevron--collapsed {
  transform: rotate(-90deg);
}

.folder-row__title {
  margin: 0;
  padding: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.folder-row__title--link:hover {
  color: var(--color-accent);
  text-decoration: underline;
}

.folder-row__count {
  margin-left: var(--space-1);
}

.folder-row__borrowed {
  padding: 1px var(--space-2);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.folder-row__borrowed:hover,
.folder-row__borrowed--active {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.folder-row__borrowed--active {
  background: var(--color-accent-subtle);
}

.folder-row__spacer {
  flex: 1;
}

.folder-row__menu {
  padding: 0 var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  line-height: 1;
}

.folder-row__menu:hover {
  color: var(--color-text);
}

/* One card tall, overflow scrolls sideways. Fixed basis, not 1fr: a row of two cards must not
   stretch them across the page. */
.folder-row__cards--strip {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  scroll-snap-type: x proximity;
  padding-bottom: var(--space-2);
}

.folder-row__cards--strip > :slotted(*) {
  flex: 0 0 140px;
  scroll-snap-align: start;
}

/* The expanded peek is a one-class change, not a second component. */
.folder-row__cards--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-3);
}

.folder-row__empty {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}
</style>
