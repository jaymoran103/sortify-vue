<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    label?: string
    placeholder?: string
    initialValue?: string
    confirmLabel?: string
    cancelLabel?: string
  }>(),
  {
    label: '',
    placeholder: '',
    initialValue: '',
    confirmLabel: 'OK',
    cancelLabel: 'Cancel',
  },
)

const emit = defineEmits<{
  confirm: [value: string]
  cancel: []
}>()

const inputValue = ref(props.initialValue)

function handleConfirm(): void {
  const trimmed = inputValue.value.trim()
  if (trimmed) {
    emit('confirm', trimmed)
  }
}
</script>

<template>
  <div class="prompt-modal">
    <h2 class="prompt-modal__title">{{ title }}</h2>
    <div class="prompt-modal__body">
      <label v-if="label" class="prompt-modal__label" for="prompt-input">{{ label }}</label>
      <input
        id="prompt-input"
        v-model="inputValue"
        class="prompt-modal__input"
        type="text"
        :placeholder="placeholder"
        @keydown.enter="handleConfirm"
        @keydown.escape.prevent="emit('cancel')"
      />
    </div>
    <div class="prompt-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">{{ cancelLabel }}</button>
      <button class="btn btn--primary" :disabled="!inputValue.trim()" @click="handleConfirm">
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.prompt-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-4);
}

.prompt-modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.prompt-modal__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.prompt-modal__input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.prompt-modal__input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.prompt-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--duration-fast) var(--ease-default);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.btn--secondary {
  background: var(--color-surface-raised);
  color: var(--color-text);
  border-color: var(--color-border);
}
</style>
