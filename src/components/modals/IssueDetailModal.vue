<script setup lang="ts">
defineProps<{
  title: string
  messages: string[]
}>()

// Simple modal for displaying non-fatal issues that occurred during an operation, such as skipped tracks during import due to missing metadata. 
// These issues are forwarded from adapters via the activity store, categorized as 'warning' so they don't show as top-level errors but remain accessible to the user.
const emit = defineEmits<{ cancel: [] }>()
</script>

<template>
  <div class="issue-detail-modal">
    <h2 class="issue-detail-modal__title">{{ title }}</h2>
    
    <!-- List of issue messages -->
    <ul class="issue-detail-modal__list">
      <li v-for="(msg, i) in messages" :key="i" class="issue-detail-modal__item">{{ msg }}</li>
    </ul>

    <!-- Close to exit -->
    <div class="issue-detail-modal__footer">
      <button class="btn btn--secondary" @click="emit('cancel')">Close</button>
    </div>
  </div>
</template>

<style scoped>
.issue-detail-modal {
  padding: var(--space-5);
  min-width: 380px;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.issue-detail-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.issue-detail-modal__list {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 320px;
  overflow-y: auto;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.issue-detail-modal__item {
  line-height: 1.5;
}

.issue-detail-modal__footer {
  display: flex;
  justify-content: flex-end;
}
</style>
