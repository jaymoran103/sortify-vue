import { createRouter, createWebHashHistory } from 'vue-router'

// Temporary toggle to route the home page to about, rather than the dashboard
// Unsure of the eventual page relationship, but this serves as a helpful intro for now

const ROUTE_TO_ABOUT = true


const router = createRouter({
  history: createWebHashHistory(),   // Hash mode for GitHub Pages compatibility
  routes: [
    {
      path: '/',
      // path: '/dashboard',
      name: 'home',
        // component: () => import('@/components/DashboardView.vue'),
      component: () => ROUTE_TO_ABOUT ? import('@/components/about/AboutView.vue')
                                      : import('@/components/dashboard/DashboardView.vue'),
    },
    {
      path: '/dashboard',
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
    {
      path: '/about',
      name: 'about',
      component: () => import('@/components/about/AboutView.vue'),
    },
   
  ],
})

export default router