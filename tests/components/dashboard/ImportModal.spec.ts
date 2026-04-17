import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ImportModal from '@/components/dashboard/ImportModal.vue'
import { useActivityStore } from '@/stores/activity'
import * as registry from '@/adapters/registry'

const mockImport = vi.fn()

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

// Navigate from initial source step to the file picker step
async function toFilesStep(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.source-card').trigger('click')
}

describe('ImportModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockImport.mockReset()
    vi.spyOn(registry, 'getImporter').mockReturnValue({
      key: 'csv',
      label: 'CSV File',
      import: mockImport,
    })
  })

  it('renders file input with multiple attribute', async () => {
    const wrapper = mount(ImportModal)
    await toFilesStep(wrapper)
    const input = wrapper.find('input[type="file"]')
    expect(input.attributes('multiple')).toBeDefined()
  })

  it('Cancel button emits cancel', async () => {
    const wrapper = mount(ImportModal)
    await wrapper.find('button.btn--secondary').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('detects CSV adapter from .csv file', async () => {
    mockImport.mockResolvedValue({ tracksImported: 5, playlistsImported: 0, errors: [] })

    const wrapper = mount(ImportModal)
    await toFilesStep(wrapper)
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
    await toFilesStep(wrapper)
    const input = wrapper.find('input[type="file"]')

    const file = new File(['{}'], 'bundle.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(registry.getImporter).toHaveBeenCalledWith('json')
  })

  it('accumulates results from multiple files', async () => {
    vi.spyOn(registry, 'getImporter')
      .mockReturnValueOnce({ key: 'csv', label: 'CSV File', import: vi.fn().mockResolvedValue({ tracksImported: 10, playlistsImported: 0, errors: [] }) })
      .mockReturnValueOnce({ key: 'json', label: 'JSON Bundle', import: vi.fn().mockResolvedValue({ tracksImported: 5, playlistsImported: 2, errors: [] }) })

    const wrapper = mount(ImportModal)
    await toFilesStep(wrapper)
    const input = wrapper.find('input[type="file"]')

    const csvFile = new File(['a,b'], 'tracks.csv', { type: 'text/csv' })
    const jsonFile = new File(['{}'], 'bundle.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', { value: [csvFile, jsonFile], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('15')
  })

  it('shows Done button label after successful import', async () => {
    mockImport.mockResolvedValue({ tracksImported: 1, playlistsImported: 0, errors: [] })

    const wrapper = mount(ImportModal)
    await toFilesStep(wrapper)
    const input = wrapper.find('input[type="file"]')

    const file = new File(['a,b'], 'data.csv', { type: 'text/csv' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.find('button.btn--secondary').text()).toBe('Done')
  })

  it('forwards CSV playlist names into activity progress labels', async () => {
    const deferred = createDeferred<{ tracksImported: number; playlistsImported: number; errors: string[] }>()
    mockImport.mockImplementation(async (_options, onProgress) => {
      onProgress?.(0.5, 1, 'tracks')
      return deferred.promise
    })

    const wrapper = mount(ImportModal)
    const activityStore = useActivityStore()
    await toFilesStep(wrapper)
    const input = wrapper.find('input[type="file"]')

    const file = new File(['a,b'], 'tracks.csv', { type: 'text/csv' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(activityStore.activeOperation?.progress).toMatchObject({
      phase: 'Importing CSV',
      itemLabel: 'tracks',
      total: 1,
    })

    deferred.resolve({ tracksImported: 1, playlistsImported: 1, errors: [] })
    await flushPromises()
  })

  it('reports per-playlist JSON progress via activity store', async () => {
    const deferred = createDeferred<{ tracksImported: number; playlistsImported: number; errors: string[] }>()
    const jsonImport = vi.fn(async (_opts, onProgress) => {
      onProgress?.(1, 3, 'Road Trip')
      return deferred.promise
    })
    vi.spyOn(registry, 'getImporter').mockReturnValue({
      key: 'json',
      label: 'JSON Bundle',
      import: jsonImport,
    })

    const wrapper = mount(ImportModal)
    const activityStore = useActivityStore()
    await toFilesStep(wrapper)
    const input = wrapper.find('input[type="file"]')

    const file = new File(['{}'], 'bundle.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(activityStore.activeOperation?.progress).toEqual({
      done: 1,
      total: 3,
      phase: 'Importing JSON',
      itemLabel: 'Road Trip',
    })

    deferred.resolve({ tracksImported: 2, playlistsImported: 3, errors: [] })
    await flushPromises()
  })
})

