import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),   // Hash mode for GitHub Pages compatibility
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/components/dashboard/DashboardView.vue'),
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: () => import('@/components/workspace/WorkspaceView.vue'),
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/components/library/LibraryView.vue'),
    },
    {
      path: '/similarity',
      name: 'similarity',
      component: () => import('@/components/similarity/SimilarityView.vue'),
    },
  ],
})

export default router