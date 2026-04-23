<script setup lang="ts">

import FeatureCard from './FeatureCard.vue'

const featureCards = [
  {
    icon: '⊞',
    title: 'Workspace',
    description: 'Load any set of playlists into a shared grid. View and toggle track membership. Create, combine and refine.',
  },
  {
    icon: '⊙',
    title: 'Spotify Sync',
    description: "Sign in once to pull your Spotify library in. No passwords stored — just a token that lets Sortify read your playlists.",
  },
  {
    icon: '▤',
    title: 'Local Files',
    description: "Import from CSV or JSON, export any time. If Spotify disappears tomorrow, your organized library doesn't.",
  },
  {
    icon: '◈',
    title: 'Similarity',
    // description: "Hunt down duplicates, equivalents, and overlaps across your library. Then clean up the mess.",
    description: "Scan your library for duplicates, equivalents, and overlaps. Then sort them out.",
    // description: "Find the playlists that overlap the most, the songs you add everywhere, and equivalent versions with different names.",
    // description: "Find the playlists that overlap the most, the songs you add everywhere, and equivalent versions with different names. Then do something about it",

    // feature spam
    // description: "Find that song saved in six different playlists. Spot the live version you forgot about. See which playlists actually share the same fifteen songs, and condense.",
    badge: 'Coming soon',
  },
]
</script>

<template>
  <div class="about-page">

    <!-- SECTION: HERO -->
    <section class="hero">
      <h1 class="hero-tagline">Your Library, Your Way.</h1>
      <p class="hero-sub">Sortify is a playlist manager that puts your content first.</p>
      <!-- <p class="hero-sub">Visualize, organize, and analyze your music, with a clean and quick interface. </p>
      <p class="hero-sub">Analysis tools highlight patterns for revision</p>
      <p class="hero-sub">the Workspace helps visualize track membership, and change it at scale.</p>
      <p class="hero-sub">the configurable Library helps visualize overlap, and makes big changes painless.</p> -->


    </section>

    <!-- SECTION: ISSUES-->
    <section class="feature-cards">
      <h2 class="section-heading">The problem.</h2>
      <!-- <p> Most music platforms prioritize discovery over organization. It's easy to find cool new content, and harder to keep your existing collections organized.</p> -->
      <!-- <p> Most music platforms prioritize discovery over organization. It's easier to find cool new content than it is to keep your existing collections organized.</p> -->
      <p> Most music platforms prioritize discovery over organization. It's much easier to find cool new content than to keep your existing collections organized.</p>
      <div style="height: var(--space-2)"></div>
      <p> Sortify is built to solve that problem. It separates your library from all the other noise, with simple but powerful tools to sort out your library.</p>

      <!-- <p> Spotify separates your library from all the other noise, providing simple but powerful tools to sort out your library.</p> -->
      <!-- <p class="hero-sub">As a result, there are far more ways to find cool mew content than there are to manage the music you've accumuluated.</p> -->
      <!-- <p class="hero-sub"> As a result, most people end up with a sprawling, unsorted collection of playlists — and no good way to manage it.</p> -->
      <!-- <p> Sortify is built to solve that problem.</p> -->

            
    </section>

    <!-- SECTION: FEATURE CARDS -->
    <section class="feature-cards">
      <h2 class="section-heading">The tools.</h2>
      <div class="cards-grid">
        <FeatureCard
          v-for="card in featureCards"
          :key="card.title"
          :icon="card.icon"
          :title="card.title"
          :description="card.description"
          :badge="card.badge"
        />
      </div>
    </section>


    

    <!-- SECTION:DATA MODEL DIAGRAM -->
    <section class="data-model">
      <h2 class="section-heading">Your data makes a loop.</h2>
      <p class="data-model-sub">Pull from Spotify once. Edit in your browser. Save to a file you own. Loop it as many times as you want.</p>
      <div class="stack-diagram">

        <div class="stack-node">
          <div class="stack-icon">⊙</div>
          <div class="stack-label">Spotify</div>
          <div class="stack-desc">Your listening history and saved playlists. Sign in once to pull them in — or skip it entirely.</div>
        </div>

        <div class="stack-arrow">
          <div class="stack-arrow-line"></div>
          <div class="stack-arrow-label">sync</div>
        </div>

        <div class="stack-node stack-node-accent">
          <!-- <div class="stack-icon">◻</div> -->
          <div class="stack-icon">⎈</div>
          <div class="stack-label">Browser</div>
          <div class="stack-desc">Stored locally in IndexedDB. Private, offline-capable, no login required. This is your working copy.</div>
        </div>

        <div class="stack-arrow">
          <div class="stack-arrow-line"></div>
          <div class="stack-arrow-label">load</div>
        </div>

        <div class="stack-node">
          <!-- <div class="stack-icon">🖴</div> -->
          <div class="stack-icon">▤</div>
          <div class="stack-label">Your files</div>
          <div class="stack-desc">CSV or JSON — yours forever. Opens in any spreadsheet app. Re-importable into Sortify on any device.</div>
        </div>

      </div>
    </section>

    <!-- SECTION: WORKSPACE -->
    <!-- <section>
      <h2 class="section-heading">Multi-playlist Workspace</h2>
    </section> -->

    

    <!--SECTION: DATA MODEL -->
     
    <section class="data-model">
      <h2 class="section-heading">Move your data, flexibly</h2>
      <p class="data-model-sub">Pull from Spotify once. Edit in your browser. Save to a file you own. Loop it as many times as you want.</p>
      
    </section>

    <!-- SECTION SIMILARITY (coming soon) -->
    <!-- <section"> </section> -->

    <!-- SECTION: ETHOS -->
    <section class="ethos">
      <h2 class="section-heading">Built for you, not for engagement.</h2>
      <dl class="ethos-list">
        <div class="ethos-item">
          <dt>No account needed.</dt>
          <dd>Sortify runs entirely in your browser. Spotify is an optional way to add music, never required.</dd>
          <dd>Your data is never tracked, shared, or fed to robots :) </dd>
        </div>
        <div class="ethos-item">
          <dt>Nothing runs on its own.</dt>
          <!-- <dt>Your tools, your decisions.</dt> -->
          <dd>Every feature is something you invoke. </dd>
          <dd>No autoplay, recommendations, no algorithmic suggestions cramed into your display.</dd>
          <!-- <dd>Every action is one you trigger. Your playlists stay the way you organized them.</dd> -->
        </div>
        <div class="ethos-item">
          <dt>Library first.</dt>
          <!-- <dt>Your library first.</dt> -->
        <dd>Sortify prioritizes your existing library over new content. </dd>
        <dd>You remain in control of what you see and hear.</dd>
          <!-- <dd>Most streaming apps bury what you've saved to surface what they want you to stream.</dd> -->
          <!-- <dd>Sortify starts with your existing collection and stays there.</dd> -->
        </div>
      </dl>
    </section>

    <!-- 7. CTA -->
    <section class="cta">
      <h2 class="h2">Time to sort.</h2>
      <div class="cta-actions">
        <button class="cta-btn" @click="$router.push('/dashboard')">Get Started</button>
        <a class="cta-btn" href="https://github.com/jaymoran103/sortify-vue" target="_blank" rel="noopener" >View Code</a>
      </div>
      <p>No signup. No install. Works offline.</p>
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
  margin: 0 auto var(--space-6);
}

/* ── Section baseline ── */
.feature-cards,
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

/* ── Data model ── */
.data-model-sub { color: var(--color-text-muted); font-size: var(--font-size-md); max-width: 560px; margin-bottom: var(--space-6); }

.stack-diagram { display: flex; align-items: center; }

.stack-node {
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  text-align: center;
}
.stack-node-accent {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
}
.stack-icon { font-size: 1.75rem; line-height: 1; color: var(--color-text-muted); }
.stack-label { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.stack-desc { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: var(--line-height-normal); }

.stack-arrow { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  gap: var(--space-1); 
  padding: 0 var(--space-2); 
  flex-shrink: 0; 
}
.stack-arrow-line { 
  width: 48px; 
  height: 2px; 
  background: var(--color-border-subtle); 
  position: relative; 
}
.stack-arrow-line::after { 
  content: '▶'; 
  position: absolute; 
  right: -6px; 
  top: -7px; 
  font-size: 10px; 
  color: var(--color-text-muted); 
}
.stack-arrow-label { 
  font-size: var(--font-size-xs); 
  color: var(--color-text-muted); 
  /* text-transform: uppercase;  */
}

/* ── Feature cards ── */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-top: var(--space-5);
}

/* ── Ethos Section── */
.ethos-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
  margin-top: var(--space-5);
}
.ethos-item { 
  display: flex; 
  flex-direction: column; 
  gap: var(--space-2); 
}
.ethos-item dt { 
    font-size: var(--font-size-md); 
    font-weight: var(--font-weight-semibold); 
    color: var(--color-text); 
}
.ethos-item dd { 
  font-size: var(--font-size-base); 
  color: var(--color-text-muted); 
  line-height: var(--line-height-normal); 
}

/* ── Call to action ── */
.cta {
  padding: var(--space-8) 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
}
.cta-btn {
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  background-color: var(--color-accent);
  color: var(--color);
  border: 2px solid var(--color-border);
}
</style>
