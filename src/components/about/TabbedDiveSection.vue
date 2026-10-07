<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  tabs: { label: string; sub: string }[]
  mockClass?: string
  /** The mock plays a short demo per tab. Tabs then show a play hint and a progress ring. */
  playable?: boolean
}>()
// Active tab defaults to none (-1), but retains value on mouse leave
const activeTab = ref(-1)

// ── Playback, for playable sections ──
// runKey changes each time a tab should play: on entering a new tab, or clicking one to
// replay it. The mock watches it and calls play, finish or cancel back through the slot.
type RunState = 'idle' | 'playing' | 'done'
const runKey = ref(0)
const runStates = ref<RunState[]>(props.tabs.map(() => 'idle'))
const runMs = ref(0)

function enter(i: number): void {
  if (activeTab.value === i) return
  activeTab.value = i
  startRun()
}

function replay(i: number): void {
  activeTab.value = i
  startRun()
}

function startRun(): void {
  // A tab left mid-run was skipped, so it goes back to idle. Finished tabs stay finished.
  runStates.value = runStates.value.map((s) => (s === 'playing' ? 'idle' : s))
  runKey.value++
}

function play(ms: number): void {
  runMs.value = ms
  runStates.value[activeTab.value] = 'playing'
}

function finish(): void {
  runStates.value[activeTab.value] = 'done'
}

function cancel(): void {
  runStates.value = runStates.value.map((s) => (s === 'playing' ? 'idle' : s))
}
</script>

<template>
  <div class="dive-body">

    <!-- Dive Sidebar Tabs: highlight when hovered, retain styling on leave -->
    <div class="dive-tabs">
      <p v-if="playable" class="dive-hint">
        <span class="dive-hint__icon" aria-hidden="true">▶</span> Hover a step to play it
      </p>
      <div class="dive-tab-list">
        <div
          v-show="activeTab >= 0"
          class="dive-tab-glider"
          :style="{
              transform: `translateY(${activeTab * 100}%)`,
              height: `${100 / props.tabs.length}%`
          }"
        ></div>
        <div
          v-for="(tab, i) in props.tabs"
          :key="i"
          class="dive-tab"
          :class="{ 'is-active': activeTab === i, [`is-${runStates[i]}`]: playable }"
          @mouseenter="playable ? enter(i) : (activeTab = i)"
          @click="playable && replay(i)"
        >
          <strong>
            <span v-if="playable" class="dive-tab__state" aria-hidden="true">{{ runStates[i] === 'done' ? '✓' : '▶' }}</span>
            {{ tab.label }}
          </strong>
          <span>{{ tab.sub }}</span>

          <!-- Progress ring: an accent line traces the tab's border over the demo's runtime. -->
          <!-- Keyed by run, so a replay restarts it from zero. -->
          <svg
            v-if="playable && runStates[i] !== 'idle'"
            :key="runKey"
            class="dive-ring"
            :style="{ '--ring-ms': `${runMs}ms` }"
            aria-hidden="true"
          >
            <rect x="1" y="1" rx="7" pathLength="100" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Mock Section: display content determined by active tab -->
    <div
      class="dive-mock"
      :class="[props.mockClass, { 'is-playing': playable && runStates[activeTab] === 'playing' }]"
    >
      <slot :activeTab="activeTab" :runKey="runKey" :play="play" :finish="finish" :cancel="cancel" />
    </div>
  </div>
</template>

<style scoped>
.dive-body {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: var(--space-6);
  align-items: start;
}

.dive-tabs {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.dive-hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent-hover);
}
.dive-hint__icon { font-size: 9px; }

.dive-tab-list {
  position: relative;
  display: flex;
  flex-direction: column;
}

.dive-tab-glider {
  position: absolute;
  inset: 0;
  background: var(--color-surface-raised);
  border-radius: var(--radius-md);
  transition: transform 0.15s ease;
  pointer-events: none;
}

.dive-tab {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.dive-tab strong {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  transition: color 0.1s;
}

.dive-tab > span {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.dive-tab.is-active strong,
.dive-tab:hover strong { color: var(--color-text); }

/* ▶ before the run, ✓ after. Accent while it plays or once done. */
.dive-tab__state {
  width: 12px;
  font-size: 10px;
  color: var(--color-text-muted);
}
.dive-tab.is-playing .dive-tab__state,
.dive-tab.is-done .dive-tab__state { color: var(--color-accent-hover); }

/* The ring sits on the tab's edge. It starts at the top left and runs clockwise. */
.dive-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.dive-ring rect {
  width: calc(100% - 2px);
  height: calc(100% - 2px);
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: dive-ring-trace var(--ring-ms) linear forwards;
}
/* A finished ring stays, fainter, as a mark of what has been seen. */
.dive-tab.is-done .dive-ring rect {
  stroke-dashoffset: 0;
  animation: none;
  opacity: 0.45;
}
@keyframes dive-ring-trace {
  to { stroke-dashoffset: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .dive-ring rect { animation: none; stroke-dashoffset: 0; }
}

.dive-mock {
  position: relative;
  /* As wide as its content, up to the column. The workspace demo grows as columns open. */
  justify-self: start;
  max-width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  font-size: var(--font-size-sm);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* While a demo plays, the mock's edge lights up so the start is plain to see. */
.dive-mock.is-playing {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent-subtle);
}

</style>
