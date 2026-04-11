import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceCard from '@/components/dashboard/WorkspaceCard.vue'
import PlaylistSelectModal from '@/components/dashboard/PlaylistSelectModal.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

const mockOpen = vi.fn()
vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: mockOpen, close: vi.fn() }),
}))

vi.mock('@/stores/sessions', () => ({
  useSessionStore: () => ({ createSession: vi.fn().mockResolvedValue(1) }),
}))

function mountCard() {
  return mount(WorkspaceCard, {
    global: { plugins: [createPinia(), router] },
  })
}

describe('WorkspaceCard', () => {
  it('shows prompt to choose playlists', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Select playlists')
  })

  it('has a Choose Playlists button', () => {
    const wrapper = mountCard()
    const btn = wrapper.find('button.btn--primary')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Choose Playlists')
  })

  it('Choose Playlists button opens PlaylistSelectModal', async () => {
    const wrapper = mountCard()
    await wrapper.find('button.btn--primary').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(PlaylistSelectModal)
  })
})
