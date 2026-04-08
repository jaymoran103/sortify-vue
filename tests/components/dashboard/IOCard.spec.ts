import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import IOCard from '@/components/dashboard/IOCard.vue'
import ImportModal from '@/components/dashboard/ImportModal.vue'
import ExportModal from '@/components/dashboard/ExportModal.vue'

const mockOpen = vi.fn()
vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: mockOpen, close: vi.fn() }),
}))

describe('IOCard', () => {
  beforeEach(() => {
    mockOpen.mockClear()
  })

  it('shows Spotify placeholder text', () => {
    const wrapper = mount(IOCard)
    expect(wrapper.text()).toContain('Spotify not connected')
  })

  it('Import button calls modal.open with ImportModal', async () => {
    const wrapper = mount(IOCard)
    await wrapper.find('#import-button').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(ImportModal)
  })

  it('Export button is always enabled', () => {
    const wrapper = mount(IOCard)
    const exportBtn = wrapper.find('#export-button')
    expect((exportBtn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('Export button calls modal.open with ExportModal', async () => {
    const wrapper = mount(IOCard)
    await wrapper.find('#export-button').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(ExportModal)
  })
})

