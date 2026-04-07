<script setup lang="ts">
import IOCard from './IOCard.vue'
import LibraryCard from './LibraryCard.vue'
import WorkspaceCard from './WorkspaceCard.vue'

// Prototype cards for I/O revision comparison
import ProtoACard from './prototypes/ProtoACard.vue'
import ProtoBCard from './prototypes/ProtoBCard.vue'
import ProtoCLocalCard from './prototypes/ProtoCLocalCard.vue'
import ProtoCSpotifyCard from './prototypes/ProtoCSpotifyCard.vue'
</script>

<template>
  <div class="dashboard">
    <h1 class="dashboard__title">Dashboard</h1>

    <!-- Real dashboard cards (unchanged) -->
    <section class="dash-section">
      <!-- <h2 class="dash-section__heading ">Current Implementation</h2> -->
      <div class="dashboard__grid">
        <IOCard />
        <LibraryCard />
        <WorkspaceCard />
      </div>
    </section>

    <!-- Prototype comparison section -->
    <section class="dash-section">
      <h2 class="dash-section__heading">I/O Card Prototypes</h2>
      <div class="dash-grid">
        <ProtoACard />
        <ProtoBCard />
        <ProtoCLocalCard />
        <ProtoCSpotifyCard />
      </div>
    </section>

  </div>
</template>

<style scoped>
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


