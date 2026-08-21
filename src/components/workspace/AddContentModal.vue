<!-- Source picker for everything that can enter the workspace. Mirrors the Import/Export
     step-one card grid: the modal only reports which card was chosen, and the caller opens
     the picker that follows. -->
<script setup lang="ts">
import type { AddContentChoice } from '@/types/ui'

const emit = defineEmits<{
  confirm: [choice: AddContentChoice]
  cancel: []
}>()

// Order matters: the two playlist cards stay adjacent so they read as a pair, with the
// track option on one end and creating something new on the other.
const choices: Array<{ choice: AddContentChoice; label: string; hint: string }> = [
  { choice: 'tracks', label: 'Add Tracks', hint: 'From your library' },
  { choice: 'playlist', label: 'Add Playlist', hint: 'From your library' },
  { choice: 'new', label: 'New Playlist', hint: 'Empty, named by you' },
]
</script>

<template>
  <div class="io-modal io-modal--add">
    <h2 class="io-modal__title">Add</h2>

    <div class="io-modal__body">
      <p class="text-muted text-sm">What are you adding to the workspace?</p>
      <div class="source-card-grid source-card-grid--3">
        <button
          v-for="option in choices"
          :key="option.choice"
          class="source-card"
          type="button"
          @click="emit('confirm', option.choice)"
        >
          <span class="source-card__label">{{ option.label }}</span>
          <span class="source-card__hint">{{ option.hint }}</span>
        </button>
      </div>
    </div>

    <div class="io-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
/* Three cards where the I/O modals have two, so the shared 420px shell is a little tight. */
.io-modal--add {
  width: 480px;
}
</style>
