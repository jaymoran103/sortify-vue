import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import IOCard from '@/components/dashboard/IOCard.vue'
import ImportModal from '@/components/dashboard/ImportModal.vue'
import ExportModal from '@/components/dashboard/ExportModal.vue'

const mockOpen = vi.fn()
vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: mockOpen, close: vi.fn() }),
}))

let mockTracks: unknown[] = []
vi.mock('@/stores/tracks', () => ({
  useTrackStore: () => ({ tracks: mockTracks }),
}))

describe('IOCard', () => {
  beforeEach(() => {
    mockOpen.mockClear()
    mockTracks = []
  })

  it('shows track count from store', () => {
    mockTracks = [{ trackID: 'a' }, { trackID: 'b' }]
    const wrapper = mount(IOCard)
    expect(wrapper.text()).toContain('2 tracks')
  })

  it('shows 0 tracks when store is empty', () => {
    const wrapper = mount(IOCard)
    expect(wrapper.text()).toContain('0 tracks')
  })

  it('Import button calls modal.open with ImportModal', async () => {
    const wrapper = mount(IOCard)
    // const importBtn = wrapper.find('button.btn--primary') //Can't use this anymore, since both buttons are now primary
    await wrapper.find('#import-button').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(ImportModal)
  })

  it('Export button is disabled when trackCount is 0', () => {
    const wrapper = mount(IOCard)
    const exportBtn = wrapper.find('#export-button')
    expect((exportBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Export button calls modal.open with ExportModal when tracks exist', async () => {
    mockTracks = [{ trackID: 'x' }]
    const wrapper = mount(IOCard)
    await wrapper.find('#export-button').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(ExportModal)
  })
})
