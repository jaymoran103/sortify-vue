<script setup lang="ts">
const emit = defineEmits<{
  confirm: [value: 'exportify']
  cancel: []
}>()
</script>

<template>
  <div class="unapproved-modal">
    <h2 class="unapproved-modal__title">Not Yet Approved for Early Testing</h2>

    <div class="unapproved-modal__content">
      <p class="unapproved-modal__message">
        Spotify restricts early access to approved accounts only. Approval is fast, but requires Jay to add you manually.
      </p>

      <div class="unapproved-modal__option">
        <h3 class="unapproved-modal__option-title">Quick Path: Use Exportify</h3>
        <p class="unapproved-modal__option-description">
          Export your playlists using <a href="https://exportify.net" target="_blank" rel="noopener noreferrer" class="unapproved-modal__link">exportify.net</a>, then import them here locally. This works immediately with no approval needed.
        </p>
      </div>

      <div class="unapproved-modal__option">
        <h3 class="unapproved-modal__option-title">Join Early Testing</h3>
        <p class="unapproved-modal__option-description">
          To be added as a user, <a href="mailto:jaymorandev@gmail.com" target="_blank" rel="noopener noreferrer" class="unapproved-modal__link">contact Jay</a> at jaymorandev@gmail.com.
        </p>
      </div>

      <!-- <p class="unapproved-modal__note">
        Wider access is 
      </p> -->
    </div>

    <div class="unapproved-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">
        Close
      </button>
      <button class="btn btn--primary" @click="emit('confirm', 'exportify')">
        Try Exportify
      </button>
    </div>
  </div>
</template>

<style scoped>
.unapproved-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.unapproved-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0;
  color: var(--color-text);
}

.unapproved-modal__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.unapproved-modal__message {
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-normal);
}

.unapproved-modal__option {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border-left: 3px solid var(--color-accent);
  background: var(--color-surface-raised);
  border-radius: var(--radius-sm);
}

.unapproved-modal__option-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  margin: 0;
  color: var(--color-text);
}

.unapproved-modal__option-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-normal);
}

.unapproved-modal__link {
  color: var(--color-accent);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.unapproved-modal__link:hover {
  text-decoration: underline;
}

.unapproved-modal__note {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  font-style: italic;
}

.unapproved-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-2);
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
</style>
