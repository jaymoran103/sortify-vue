<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_DESCRIPTION_LENGTH, cleanDescription } from '@/utils/playlistDescription'

// Edits one playlist's description. Unlike PromptModal, an empty value is a valid answer:
// it clears the description, and export then falls back to the Sortify link.
const props = withDefaults(
  defineProps<{
    playlistName: string
    initialValue?: string
  }>(),
  { initialValue: '' },
)

const emit = defineEmits<{
  confirm: [value: string]
  cancel: []
}>()

const text = ref(props.initialValue)
const length = computed(() => cleanDescription(text.value).length)
const tooLong = computed(() => length.value > MAX_DESCRIPTION_LENGTH)

function handleConfirm(): void {
  if (tooLong.value) return
  emit('confirm', cleanDescription(text.value))
}
</script>

<template>
  <div class="io-modal">
    <h2 class="io-modal__title">Playlist Description</h2>
    <div class="io-modal__field">
      <label class="io-modal__label" for="description-input">{{ playlistName }}</label>
      <textarea
        id="description-input"
        v-model="text"
        class="io-modal__textarea"
        placeholder="Leave empty to use the Sortify link"
        @keydown.enter.exact.prevent="handleConfirm"
        @keydown.escape.prevent="emit('cancel')"
      />
      <p class="io-modal__hint">
        <span>Sent to Spotify when you export. Line breaks become spaces.</span>
        <span :class="{ 'io-modal__error': tooLong }">{{ length }}/{{ MAX_DESCRIPTION_LENGTH }}</span>
      </p>
    </div>
    <div class="io-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">Cancel</button>
      <button class="btn btn--primary" :disabled="tooLong" @click="handleConfirm">Save</button>
    </div>
  </div>
</template>
