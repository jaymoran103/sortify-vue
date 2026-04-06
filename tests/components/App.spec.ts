import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from '@/App.vue'

describe('App', () => {
  it('mounts without error', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createWebHashHistory(),
      routes: [{ path: '/', component: { template: '<div>home</div>' } }],
    })

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
      },
    })

    await router.isReady()

    expect(wrapper.exists()).toBe(true)
  })
})
