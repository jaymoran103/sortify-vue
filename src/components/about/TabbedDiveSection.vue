<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  tabs: { label: string; sub: string }[]
  mockClass?: string
}>()
// Active tab defaults to none (-1), but retains value on mouse leave
const activeTab = ref(-1)
</script>

<template>
  <div class="dive-body">

    <!-- Dive Sidebar Tabs: highlight when hovered, retain styling on leave -->
    <div class="dive-tabs">
    <!-- <div class="dive-tabs" @mouseleave="activeTab = -1"> -->
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
        :class="{ 'is-active': activeTab === i }"
        @mouseenter="activeTab = i"
      >
        <strong>{{ tab.label }}</strong>
        <span>{{ tab.sub }}</span>
      </div>
    </div>

    <!-- Mock Section: display content determined by active tab -->
    <div class="dive-mock" :class="props.mockClass">
      <slot :activeTab="activeTab" />
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
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  transition: color 0.1s;
}

.dive-tab span {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.dive-tab.is-active strong,
.dive-tab:hover strong { color: var(--color-text); }

.dive-mock {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  font-size: var(--font-size-sm);
}

.sim-mock { max-height: 320px; }
</style>
