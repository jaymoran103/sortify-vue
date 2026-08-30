<script lang="ts">
/**
 * Row height in pixels, published for callers to hand to ScrollableList.
 *
 * ScrollableList is a fixed-pitch virtualiser: it positions rows at index * estimateSize and
 * never measures them, so this is the row pitch, not a hint. A row that renders at any other
 * height overlaps its neighbour by the difference.
 *
 * Bound to `height` below, not `min-height`, and not set in the stylesheet. A floor would let
 * content grow the row past the pitch — a track with a long artist list used to wrap its
 * subtitle onto a second line and do exactly that. Both lines truncate instead, so the number
 * the virtualiser is told is the number the row is, whatever it contains.
 */
export const SELECTABLE_ITEM_HEIGHT = 56
</script>

<script setup lang="ts">
defineProps<{
  label: string
  subtitle?: string
  selected: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const rowHeight = `${SELECTABLE_ITEM_HEIGHT}px`
</script>

<template>
  <!-- no-text-select: the row is a click target, so dragging across a list of them should not
       leave a text highlight. No shift guard here — these rows do not handle shift-click. -->
  <!-- height is bound, not styled: see SELECTABLE_ITEM_HEIGHT above. -->
  <div
    class="selectable-item no-text-select"
    :class="{ 'selectable-item--selected': selected }"
    :style="{ height: rowHeight }"
    @click="emit('toggle')"
  >
    <input
      type="checkbox"
      class="selectable-item__checkbox"
      :checked="selected"
      tabindex="-1"
      @click.stop
      @change="emit('toggle')"
    />
    <!-- Both lines truncate, so title carries the value the ellipsis hides. -->
    <div class="selectable-item__content">
      <span class="selectable-item__label" :title="label">{{ label }}</span>
      <span v-if="subtitle" class="selectable-item__subtitle" :title="subtitle">{{ subtitle }}</span>
    </div>
  </div>
</template>

<style scoped>
.selectable-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  box-sizing: border-box;
  /* Belt to the height brace: nothing inside can spill past the pitch. */
  overflow: hidden;
  cursor: pointer;
  border-radius: 0;
  transition: background var(--duration-fast) var(--ease-default);
}

.selectable-item:hover {
  background: var(--color-row-hover);
}

.selectable-item--selected {
  background: var(--color-accent-subtle);
}

.selectable-item--selected:hover {
  background: var(--color-accent-subtle);
}

.selectable-item__checkbox {
  flex-shrink: 0;
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.selectable-item__content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.selectable-item__label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Same truncation as the label. A track's artist list is unbounded, and wrapping it onto a
   second line grew the row past the pitch the virtualiser lays rows out at. */
.selectable-item__subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
