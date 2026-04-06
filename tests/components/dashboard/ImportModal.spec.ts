import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ImportModal from '@/components/dashboard/ImportModal.vue'
import * as registry from '@/adapters/registry'

const mockImport = vi.fn()

describe('ImportModal', () => {
  beforeEach(() => {
    mockImport.mockReset()
    vi.spyOn(registry, 'getImporter').mockReturnValue({
      key: 'csv',
      label: 'CSV File',
      import: mockImport,
    })
  })

  it('renders file input and format hint', () => {
    const wrapper = mount(ImportModal)
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Supported formats')
  })

  it('Cancel button emits cancel', async () => {
    const wrapper = mount(ImportModal)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('detects CSV adapter from .csv file', async () => {
    mockImport.mockResolvedValue({ tracksImported: 5, playlistsImported: 0, errors: [] })

    const wrapper = mount(ImportModal)
    const input = wrapper.find('input[type="file"]')

    const file = new File(['a,b'], 'tracks.csv', { type: 'text/csv' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(registry.getImporter).toHaveBeenCalledWith('csv')
  })

  it('detects JSON adapter from .json file', async () => {
    vi.spyOn(registry, 'getImporter').mockReturnValue({
      key: 'json',
      label: 'JSON Bundle',
      import: mockImport.mockResolvedValue({ tracksImported: 2, playlistsImported: 1, errors: [] }),
    })

    const wrapper = mount(ImportModal)
    const input = wrapper.find('input[type="file"]')

    const file = new File(['{}'], 'bundle.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(registry.getImporter).toHaveBeenCalledWith('json')
  })

  it('shows summary on completion', async () => {
    mockImport.mockResolvedValue({ tracksImported: 42, playlistsImported: 3, errors: [] })

    const wrapper = mount(ImportModal)
    const input = wrapper.find('input[type="file"]')

    const file = new File(['a,b'], 'data.csv', { type: 'text/csv' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('3')
  })

  it('shows Done button label after successful import', async () => {
    mockImport.mockResolvedValue({ tracksImported: 1, playlistsImported: 0, errors: [] })

    const wrapper = mount(ImportModal)
    const input = wrapper.find('input[type="file"]')

    const file = new File(['a,b'], 'data.csv', { type: 'text/csv' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.find('button').text()).toBe('Done')
  })
})
