<!-- Exit warning for the workspace. Reports what leaving costs, and offers the only actions
     that can answer it. Built rather than reusing ConfirmModal because it needs a third
     action and a secondary tier of message. -->
<script setup lang="ts">
import type { LeaveChoice } from '@/types/ui'

withDefaults(
  defineProps<{
    /** Loss-class messages: the reason this dialog is open at all */
    lossMessages: string[]
    /** Quality-class messages: advisory, never the reason the dialog opened */
    qualityMessages?: string[]
    /**
     * Whether saving would actually do anything. False when the only loss is unassigned
     * tracks, which no save can rescue — offering "Save & leave" there would promise a
     * rescue that does not happen.
     */
    canSave?: boolean
  }>(),
  { qualityMessages: () => [], canSave: false },
)

const emit = defineEmits<{
  confirm: [choice: LeaveChoice]
  cancel: []
}>()
</script>

<template>
  <div class="leave-modal">
    <h2 class="leave-modal__title">Leave Workspace</h2>

    <div class="leave-modal__body">
      <p v-for="message in lossMessages" :key="message" class="leave-modal__line">
        {{ message }}
      </p>

      <!-- FUTURE: provisional. These are advisories the buttons below cannot resolve, and
           the column header already marks empty playlists for the whole session. Worth
           removing if it reads as noise once this has been used for a while. -->
      <div v-if="qualityMessages.length > 0" class="leave-modal__footnote">
        <p v-for="message in qualityMessages" :key="message" class="leave-modal__footnote-line">
          {{ message }}
        </p>
      </div>
    </div>

    <div class="leave-modal__footer">
      <button class="btn btn--ghost" @click="emit('cancel')">Stay</button>
      <button class="btn btn--secondary" @click="emit('confirm', 'leave')">Leave</button>
      <button v-if="canSave" class="btn btn--primary" @click="emit('confirm', 'save')">
        Save &amp; leave
      </button>
    </div>
  </div>
</template>

<style scoped>
.leave-modal {
  padding: var(--space-5);
  width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.leave-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.leave-modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.leave-modal__line {
  margin: 0;
}

/* Set apart, not just dimmed: these are a different class of statement from the lines above. */
.leave-modal__footnote {
  margin-top: var(--space-1);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.leave-modal__footnote-line {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.leave-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
