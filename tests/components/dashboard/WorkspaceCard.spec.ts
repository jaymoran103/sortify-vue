import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkspaceCard from '@/components/dashboard/WorkspaceCard.vue'
import PlaylistSelectModal from '@/components/dashboard/PlaylistSelectModal.vue'

const mockOpen = vi.fn()
vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: mockOpen, close: vi.fn() }),
}))

describe('WorkspaceCard', () => {
  it('shows prompt to choose playlists', () => {
    const wrapper = mount(WorkspaceCard)
    expect(wrapper.text()).toContain('Select playlists')
  })

  it('has a Choose Playlists button', () => {
    const wrapper = mount(WorkspaceCard)
    const btn = wrapper.find('button.btn--primary')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Choose Playlists')
  })

  it('Choose Playlists button opens PlaylistSelectModal', async () => {
    const wrapper = mount(WorkspaceCard)
    await wrapper.find('button.btn--primary').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(PlaylistSelectModal)
  })
})
