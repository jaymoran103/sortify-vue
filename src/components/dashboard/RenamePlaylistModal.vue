<script setup lang="ts">
import { ref } from 'vue'
import type { Playlist } from '@/types/models'

const props = defineProps<{
  playlist: Playlist
}>()

const emit = defineEmits<{
  confirm: [name: string]
  cancel: []
}>()

const name = ref(props.playlist.name)

function handleConfirm(): void {
  const trimmed = name.value.trim()
  if (trimmed) emit('confirm', trimmed)
}
</script>

<template>
  <div class="rename-modal">
    <h2 class="rename-modal__title">Rename Playlist</h2>

    <div class="rename-modal__body">
      <label class="rename-modal__label" for="rename-input">New name</label>
      <input
        id="rename-input"
        v-model="name"
        class="rename-modal__input"
        type="text"
        autocomplete="off"
        @keydown.enter="handleConfirm"
        @keydown.escape="emit('cancel')"
      />
    </div>

    <div class="rename-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
      <button class="btn btn--primary" :disabled="!name.trim()" @click="handleConfirm">
        Rename
      </button>
    </div>
  </div>
</template>

<style scoped>
.rename-modal {
  padding: var(--space-5);
  min-width: 320px;
}

.rename-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-4);
}

.rename-modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.rename-modal__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.rename-modal__input {
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  width: 100%;
}

.rename-modal__input:focus {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.rename-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
