import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ExportModal from '@/components/dashboard/ExportModal.vue'
import * as registry from '@/adapters/registry'

const mockExport = vi.fn()

describe('ExportModal', () => {
  beforeEach(() => {
    mockExport.mockReset()
    vi.spyOn(registry, 'getExporter').mockReturnValue({
      key: 'csv',
      label: 'CSV File',
      export: mockExport,
    })
  })

  it('renders format dropdown', () => {
    const wrapper = mount(ExportModal)
    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain('Format')
  })

  it('shows profile dropdown for CSV format', () => {
    const wrapper = mount(ExportModal)
    // default is csv, so profile row should be visible
    expect(wrapper.text()).toContain('Profile')
  })

  it('hides profile dropdown when JSON format selected', async () => {
    const wrapper = mount(ExportModal)
    const formatSelect = wrapper.find('select')
    await formatSelect.setValue('json')
    expect(wrapper.text()).not.toContain('Profile')
  })

  it('calls getExporter with selected format on export click', async () => {
    mockExport.mockResolvedValue({ playlistsExported: 1, errors: [] })

    const wrapper = mount(ExportModal)
    const exportBtn = wrapper.find('button.btn--primary')
    await exportBtn.trigger('click')
    await flushPromises()

    expect(registry.getExporter).toHaveBeenCalledWith('csv')
    expect(mockExport).toHaveBeenCalled()
  })

  it('shows done state after export', async () => {
    mockExport.mockResolvedValue({ playlistsExported: 2, errors: [] })

    const wrapper = mount(ExportModal)
    await wrapper.find('button.btn--primary').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Export complete')
    expect(wrapper.find('button.btn--primary').exists()).toBe(false)
  })

  it('Cancel button emits cancel', async () => {
    const wrapper = mount(ExportModal)
    await wrapper.find('button.btn--secondary').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('Export button disabled during export', async () => {
    mockExport.mockImplementation(() => new Promise(() => {})) // never resolves

    const wrapper = mount(ExportModal)
    await wrapper.find('button.btn--primary').trigger('click')

    const exportBtn = wrapper.find('button.btn--primary')
    expect((exportBtn.element as HTMLButtonElement).disabled).toBe(true)
  })
})
