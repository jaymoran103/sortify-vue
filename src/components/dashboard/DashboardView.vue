<script setup lang="ts">
import AppTopBar from '@/components/common/AppTopBar.vue'
import IOCard from './IOCard.vue'
import LibraryCard from './LibraryCard.vue'
import WorkspaceCard from './WorkspaceCard.vue'

</script>

<template>
  <AppTopBar />
  <div class="dashboard">
    <!-- About is reached from the top bar now, so the heading carries the title alone. -->
    <div class="dashboard__header">
      <h1 class="dashboard__title">Dashboard</h1>
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


