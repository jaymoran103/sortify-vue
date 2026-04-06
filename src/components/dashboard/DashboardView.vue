<script setup lang="ts">
import IOCard from './IOCard.vue'
</script>

<template>
  <div class="dashboard">
    <h1 class="dashboard__title">Dashboard</h1>
    <div class="dashboard__grid">
      <IOCard />
    </div>
  </div>
</template>

<style scoped>
/* TODO move styling elsewhere */
.dashboard {
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-6);
}

.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-6);
}
</style>


