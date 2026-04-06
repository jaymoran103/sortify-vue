<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  { placeholder: 'Search...' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="search-bar">
    <span class="search-bar__icon" aria-hidden="true">⌕</span>
    <input
      type="search"
      class="search-bar__input"
      :value="modelValue"
      :placeholder="placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      class="search-bar__clear"
      aria-label="Clear search"
      @click="emit('update:modelValue', '')"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
}

.search-bar__icon {
  position: absolute;
  left: var(--space-2);
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  pointer-events: none;
  line-height: 1;
}

.search-bar__input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  padding-left: calc(var(--space-2) + var(--font-size-md) + var(--space-2));
  padding-right: var(--space-5);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-full);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.search-bar__input:focus {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* Hide browser's built-in clear button — we have our own */
.search-bar__input::-webkit-search-cancel-button {
  display: none;
}

.search-bar__clear {
  position: absolute;
  right: var(--space-2);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  cursor: pointer;
  padding: var(--space-1);
  line-height: 1;
}

.search-bar__clear:hover {
  color: var(--color-text);
}
</style>
