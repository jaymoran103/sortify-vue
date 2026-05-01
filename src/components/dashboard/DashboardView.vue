<script setup lang="ts">
import IOCard from './IOCard.vue'
import LibraryCard from './LibraryCard.vue'
import WorkspaceCard from './WorkspaceCard.vue'

</script>

<template>
  <div class="dashboard">
    <div class="dashboard__header">
      <h1 class="dashboard__title">Dashboard</h1>
      <button class="about-btn" @click="$router.push({ name: 'about' })">About Sortify</button>
    </div>

    <!-- Main Dashboard Section -->
    <section class="dash-section">

      <!-- No section heading needed while a single section exists -->
      <!-- <h2 class="dash-section__heading ">Current Implementation</h2> -->

      <div class="dashboard__grid">
        <IOCard />
        <LibraryCard />
        <WorkspaceCard />
      </div>

    </section>

    <!-- Additional sections would go here -->
    <!-- <section class="dash-section"> </section> -->

  </div>
</template>

<style scoped>
.dashboard {
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.dashboard__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.dashboard .about-btn {
  color: var(--color-text-muted);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
    
  border: 2px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.dashboard .about-btn:hover {
  border-color: var(--color-accent);
  background: var(--color-surface);
}

.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-6);
}


/* Real section divider */
.dash-section {
  /* padding-top: var(--space-6);
  padding-bottom: var(--space-6); */
  padding: var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
}
.dash-section__heading {
  margin-bottom: var(--space-4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
}

</style>


