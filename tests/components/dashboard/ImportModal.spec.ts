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

  it('renders file input with multiple attribute', () => {
    const wrapper = mount(ImportModal)
    const input = wrapper.find('input[type="file"]')
    expect(input.attributes('multiple')).toBeDefined()
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

  it('accumulates results from multiple files', async () => {
    // First call returns csv result, second call returns json result
    vi.spyOn(registry, 'getImporter')
      .mockReturnValueOnce({ key: 'csv', label: 'CSV File', import: vi.fn().mockResolvedValue({ tracksImported: 10, playlistsImported: 0, errors: [] }) })
      .mockReturnValueOnce({ key: 'json', label: 'JSON Bundle', import: vi.fn().mockResolvedValue({ tracksImported: 5, playlistsImported: 2, errors: [] }) })

    const wrapper = mount(ImportModal)
    const input = wrapper.find('input[type="file"]')

    const csvFile = new File(['a,b'], 'tracks.csv', { type: 'text/csv' })
    const jsonFile = new File(['{}'], 'bundle.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', { value: [csvFile, jsonFile], configurable: true })
    await input.trigger('change')
    await flushPromises()

    // Should show combined 15 tracks
    expect(wrapper.text()).toContain('15')
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
