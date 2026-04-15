import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import IOCard from '@/components/dashboard/IOCard.vue'
import ImportModal from '@/components/dashboard/ImportModal.vue'
import ExportModal from '@/components/dashboard/ExportModal.vue'

const mockOpen = vi.fn()
vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: mockOpen, close: vi.fn() }),
}))

let mockPlaylists: unknown[] = []
vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({ playlists: mockPlaylists }),
}))

function mountCard() {
  return mount(IOCard, {
    global: { plugins: [createPinia()] },
  })
}

describe('IOCard', () => {
  beforeEach(() => {
    mockOpen.mockClear()
    mockPlaylists = []
  })

  it('shows Spotify placeholder text', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Spotify not connected')
  })

  it('Import button calls modal.open with ImportModal', async () => {
    const wrapper = mountCard()
    await wrapper.find('#import-button').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(ImportModal)
  })

  it('Export button is disabled when library is empty', () => {
    const wrapper = mountCard()
    const exportBtn = wrapper.find('#export-button')
    expect((exportBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Export button has a tooltip when library is empty', () => {
    const wrapper = mountCard()
    const exportBtn = wrapper.find('#export-button')
    expect(exportBtn.attributes('title')).toBeTruthy()
  })

  it('Export button is enabled when playlists exist', () => {
    mockPlaylists = [{ id: 1, name: 'Mix', trackIDs: [] }]
    const wrapper = mountCard()
    const exportBtn = wrapper.find('#export-button')
    expect((exportBtn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('Export button has no tooltip when playlists exist', () => {
    mockPlaylists = [{ id: 1, name: 'Mix', trackIDs: [] }]
    const wrapper = mountCard()
    const exportBtn = wrapper.find('#export-button')
    expect(exportBtn.attributes('title')).toBeFalsy()
  })

  it('Export button calls modal.open with ExportModal when playlists exist', async () => {
    mockPlaylists = [{ id: 1, name: 'Mix', trackIDs: [] }]
    const wrapper = mountCard()
    await wrapper.find('#export-button').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(ExportModal)
  })
})

