<script setup lang="ts">
import { computed, ref } from 'vue'
import TabbedDiveSection from './TabbedDiveSection.vue'
import WorkspaceMock from './WorkspaceMock.vue'
import OverlapMock from './OverlapMock.vue'
import DoublesMock from './DoublesMock.vue'
import { DOUBLES_DRAFTS } from './doublesDrafts'
import DataFlowDiagram from './DataFlowDiagram.vue'

const workspaceTabs = [
  { label: 'Edit memberships', sub: 'Click a tile to add or remove a track. Nothing is permanent until you save.' },
  { label: 'Arrange playlists', sub: 'Click a header to open or close it. Drag one to reorder.' },
  { label: 'Save & Export', sub: 'Save your changes, then download them as CSV or JSON.' },
  // { label: 'Track Actions', sub: 'Toggle across multiple playlists at once, or open in Spotify' },
]
const overlapTabs = [
  { label: 'Rank by overlap', sub: 'Pick a playlist. See how much of it every other playlist shares.' },
  { label: 'Compare a pair', sub: 'Open any result to see what is only here, only there, and in both.' },
  { label: 'Act on it', sub: 'Save the shared tracks as a playlist, or clear them out of one side.' },
]
// Hidden for now: the overlap and doubles showcases. Flip to show them again.
const showComingSoon = false

// DRAFT: the doubles emphasis is still being chosen. The picker shows in dev builds only.
const showDraftPicker = import.meta.env.DEV
const doublesDraftKey = ref(DOUBLES_DRAFTS[0]!.key)
const doublesDraft = computed(() => DOUBLES_DRAFTS.find((d) => d.key === doublesDraftKey.value) ?? DOUBLES_DRAFTS[0]!)
</script>

<template>
  <div class="about-page">

    <!-- SECTION: HERO -->
    <section class="hero">
      <h1 class="hero-tagline">Your Library, Your Way.</h1>
      <p class="hero-sub">Sortify – a playlist manager that puts your content first.</p>
    </section>

    <!-- SECTION: PROBLEM STATEMENT-->
    <section class="feature-cards">
      <h2 class="section-heading">The problem.</h2>

      <p class="section-sub">Most music platforms prioritize discovery over organization. It's much easier to find cool new content than to keep your existing library clean.</p>
      <p class="section-sub"><b>Sortify</b> is built to solve that problem. It separates your library from all the other noise, with simple but powerful tools to sort out your music.</p>

    </section>

    <!-- SECTION: WORKSPACE -->
    <section class="workspace-dive">
      <h2 class="section-heading">Multi-playlist Workspace</h2>
      <TabbedDiveSection :tabs="workspaceTabs">

        <template #default="{ activeTab }">
          <WorkspaceMock :activeTab="activeTab" />
        </template>

      </TabbedDiveSection>
    </section>


    <!-- DATA MODEL DIAGRAM -->
    <section class="data-model">

      <h2 class="section-heading">Move your data flexibly.</h2>
      <p class="data-model-sub">Your browser holds the working copy. Everything else is a way in or out.</p>
      <DataFlowDiagram />

      <p class="section-sub">Sortify runs entirely in your browser. Your data is never tracked, shared, or fed to robots :)</p>

    </section>

    <!-- SECTION: OVERLAP (coming soon) -->
    <section v-if="showComingSoon" class="workspace-dive">
      <h2 class="section-heading">Find the overlap </h2>
      <TabbedDiveSection :tabs="overlapTabs">
        <template #default="{ activeTab }">
          <OverlapMock :activeTab="activeTab" />
        </template>
      </TabbedDiveSection>
    </section>

    <!-- SECTION: DOUBLES (coming soon) -->
    <section v-if="showComingSoon" class="workspace-dive">
      <h2 class="section-heading">Sort out the doubles </h2>
      <div v-if="showDraftPicker" class="draft-picker" role="group" aria-label="Doubles emphasis draft">
        <span class="draft-picker-label">Draft</span>
        <button
          v-for="d in DOUBLES_DRAFTS"
          :key="d.key"
          class="btn btn--sm"
          :class="d.key === doublesDraftKey ? 'btn--primary' : 'btn--ghost'"
          @click="doublesDraftKey = d.key"
        >{{ d.name }}</button>
      </div>
      <TabbedDiveSection :key="doublesDraft.key" :tabs="doublesDraft.tabs">
        <template #default="{ activeTab }">
          <DoublesMock :activeTab="activeTab" :draft="doublesDraft" />
        </template>
      </TabbedDiveSection>
    </section>

    <!-- SECTION: ACCOUNTLESS-->
    <section class="feature-cards">
      <h2 class="section-heading">Private, Simple, Flexible.</h2>

      <p class="section-sub">Sortify runs entirely in your browser. Your data is never tracked, shared, or fed to robots :)</p>
    </section>

    <!-- 7. CTA -->
    <section class="cta">
      <h2 class="cta-heading">Time to sort!</h2>
      <div class="cta-actions">
        <RouterLink to="/dashboard" class="cta-btn cta-btn-primary">Open Sortify</RouterLink>
        <a href="https://github.com/jaymoran103/sortify-vue" target="_blank" rel="noopener" class="cta-btn cta-btn-ghost">View Codebase</a>
      </div>
      <p class="cta-note">No signup. No install. Works offline.</p>
      <p class="cta-note">Looking for the first release? The <a class="cta-link" href="https://jaymoran103.github.io/sortify-feb" target="_blank" rel="noopener">original version</a> is still up.</p>
    </section>

  </div>
</template>

<style scoped>
.about-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

/* ── Hero ── */
.hero { text-align: center; padding: var(--space-8) 0; }
.hero-tagline {
  font-size: 3rem;
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  margin-bottom: var(--space-3);
}
.hero-sub {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  max-width: 580px;
  margin: 0 auto;
}
/* ── Section baseline ── */
.workspace-dive,
.feature-cards,
.data-model,
.cta {
  padding: var(--space-6) 0;
  border-top: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
}

.section-heading {
  font-size: 2rem;
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-5);
}

/* ── Section text ── */
.section-sub { color: var(--color-text-muted); font-size: var(--font-size-md); line-height: var(--line-height-normal); margin-bottom: var(--space-4); }
.data-model-sub { color: var(--color-text-muted); font-size: var(--font-size-md); max-width: 560px; margin-bottom: var(--space-6); }

/* ── Doubles draft picker (dev only) ── */
.draft-picker { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-5); }
.draft-picker-label { font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.06em; }

/* ── Call to action ── */
.cta {
  padding: var(--space-8) 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
}
.cta-heading {
  font-size: 2rem;
  font-weight: var(--font-weight-bold);
}
.cta-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  }
.cta-btn {
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition: opacity 0.1s;
}
.cta-btn:hover {opacity: 0.85; }
.cta-btn-primary {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}
.cta-btn-ghost {
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
  cursor: pointer;
}
.cta-note {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.cta-link { color: var(--blue-450); text-decoration: underline; }
</style>
