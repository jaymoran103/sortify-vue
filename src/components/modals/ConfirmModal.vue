<script setup lang="ts">

// Generic confirmation modal for actions like delete, clear, etc. Can be used anywhere in the app by emitting events to the BaseModal component.

// Props with default values
withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    danger: false,
  },
)
// Emit events for confirm and cancel actions
const emit = defineEmits<{
  confirm: [value: true]
  cancel: []
}>()
</script>

<template>
  <div class="confirm-modal">
    <h2 class="confirm-modal__title">{{ title }}</h2>
    <p class="confirm-modal__message">{{ message }}</p>
    <div class="confirm-modal__footer">
      <!-- Cancel Button: Emit cancel event-->
      <button class="btn btn--secondary" @click="emit('cancel')">
        {{ cancelLabel }}
      </button>
      <!-- Confirm Button: Emit confirm event, styled based on danger prop -->
      <button
        class="btn"
        :class="danger ? 'btn--danger' : 'btn--primary'" 
        @click="emit('confirm', true)"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.confirm-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
}

.confirm-modal__message {
  color: var(--color-text-muted);
  margin-bottom: var(--space-5);
  line-height: var(--line-height-normal);
}

.confirm-modal__footer {
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

.btn--primary {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.btn--primary:hover {
  background: var(--color-accent-hover);
}

.btn--secondary {
  background: var(--color-surface-raised);
  color: var(--color-text);
  border-color: var(--color-border-subtle);
}

.btn--secondary:hover {
  background: var(--color-row-hover);
}

.btn--danger {
  background: var(--color-danger);
  color: var(--color-text-on-accent);
}

.btn--danger:hover {
  background: var(--color-danger-hover);
}
</style>
