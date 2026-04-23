<script setup lang="ts">



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

        <!-- FEATURE 1 -->
          <div class="feat-card">
            <div class="feat-card-icon">{{ '⊞' }}</div>
            <div class="feat-card-body">
            <h3>{{ 'Workspace' }}</h3>
            <p>{{ 'Load any set of playlists into a shared grid. View and toggle track membership. Create, combine and refine.' }}</p>
          </div>
        </div>

        <!-- FEATURE 2 -->
        <div class="feat-card">
              <div class="feat-card-icon">{{ '⊙' }}</div>
              <div class="feat-card-body">
            <div class="feat-card-body">
              <h3>{{ 'Spotify Sync' }}</h3>
              <p>{{ 'Sync your playlists with Spotify. Keep your library up-to-date effortlessly.' }}</p>
            </div>
          </div>
        </div>
        

        <!-- FEATURE 3 -->
        <div class="feat-card">
            <div class="feat-card-icon">{{ '▤' }}</div>
            <div class="feat-card-body">
          <div class="feat-card-body">
            <h3>{{ 'Local Files' }}</h3>
            <p>{{ "Import from CSV or JSON, export any time. If Spotify disappears tomorrow, your organized library doesn't." }}</p>
          </div>
        </div>
        </div>

        <!-- FEATURE 4 -->
        <div class="feat-card">
            <div class="feat-card-icon">{{ '◈' }}</div>
            <div class="feat-card-body">
          <div class="feat-card-body">
            <h3>{{ 'Similarity' }}</h3>
            <p>{{ "Find the playlists that overlap the most, the songs you add everywhere, and equivalent versions with different names." }}</p>
          </div>
        </div>
      </div>

        
      </div>
    </section>

    <!-- SECTION: WORKSPACE -->
    <!-- <section>
      <h2 class="section-heading">Multi-playlist Workspace</h2>
    </section> -->

    

    <!-- 4. DATA MODEL -->
     
    <section class="data-model">
      <h2 class="section-heading">Move your data, flexibly</h2>
      <p class="data-model-sub">Pull from Spotify once. Edit in your browser. Save to a file you own. Loop it as many times as you want.</p>
      
    </section>

    <!-- 5. SIMILARITY (coming soon) -->
    <!-- <section"> </section> -->

    <!-- 6. ETHOS -->
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
  margin-bottom: var(--space-2);
}
.hero-sub {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  max-width: 580px;
  margin: 0 auto var(--space-4);
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
.ethos-item { display: flex; 
  flex-direction: column; 
  gap: var(--space-2); 

  font-size: var(--font-size-base); 
  color: var(--color-text-muted); 
  line-height: var(--line-height-normal); 
}

.ethos-item dt {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
} 

/* ── Call to action ── */
.cta {
  padding: var(--space-8) var(--space-8) ;
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
