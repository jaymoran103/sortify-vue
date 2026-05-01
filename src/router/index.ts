import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),   // Hash mode for GitHub Pages compatibility
  routes: [
    // Site Root: currently uses /about as a landing page.
    {
      path: '/',
      name: 'home',
      component: () => import('@/components/about/AboutView.vue'),
    },

    // About page: Scrollable informational page outlining app functionality and uses. 
    // Currently serves as the root landing page, this may change as the app develops and we move to a shell-based UI model.
    {
      path: '/about',
      name: 'about',
      component: () => import('@/components/about/AboutView.vue'),
    },

    // Dashboard View: Current primary hub for app functionality. 
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/components/dashboard/DashboardView.vue'),
    },

    // Workspace View: Main sorting interface.
    {
      path: '/workspace',
      name: 'workspace',
      component: () => import('@/components/workspace/WorkspaceView.vue'),
    },
    // Library View: not yet implemented. 
    {
      path: '/library',
      name: 'library',
      component: () => import('@/components/library/LibraryView.vue'),
    },
    // Similarity View: not yet implemented.
    {
      path: '/similarity',
      name: 'similarity',
      component: () => import('@/components/similarity/SimilarityView.vue'),
    },
    {
      // Catch-all: redirect unknown paths to dashboard
      path: '/:pathMatch(.*)*',
      redirect: { name: 'dashboard' },
    },
  ],
})

export default router