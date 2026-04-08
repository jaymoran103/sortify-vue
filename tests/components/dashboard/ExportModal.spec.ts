import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, disableAutoUnmount } from '@vue/test-utils'
import ExportModal from '@/components/dashboard/ExportModal.vue'
import * as registry from '@/adapters/registry'
import type { Playlist } from '@/types/models'
import { deprecate } from 'util'

const mockExport = vi.fn()

// Provide mock playlists so the inline playlist step is functional
const playlists: Playlist[] = [
  { id: 1, name: 'Test Playlist', trackIDs: ['a', 'b'] },
]

vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({ playlists }),
}))

// Stub ScrollableList to render items directly (no virtualizer DOM requirements)
const ScrollableListStub = {
  props: ['items', 'keyField', 'estimateSize'],
  template: `
    <div>
      <template v-if="items.length === 0">
        <slot name="empty" />
      </template>
      <template v-else v-for="(item, index) in items" :key="index">
        <slot name="item" :item="item" :index="index" />
      </template>
    </div>
  `,
}

function mountOptions() {
  return { global: { stubs: { ScrollableList: ScrollableListStub } } }
}

// Navigate from initial source step through playlist selection to the options step
async function toOptionsStep(wrapper: ReturnType<typeof mount>) {
  // Source step: choose Local Files
  await wrapper.find('.source-card').trigger('click')
  // Playlists step: select all then proceed
  await wrapper.find('.io-modal__select-all').trigger('click')
  await wrapper.find('button.btn--primary').trigger('click')
}

describe('ExportModal', () => {
  beforeEach(() => {
    mockExport.mockReset()
    vi.spyOn(registry, 'getExporter').mockReturnValue({
      key: 'csv',
      label: 'CSV File',
      export: mockExport,
    })
  })

  it('renders format dropdown', async () => {
    const wrapper = mount(ExportModal, mountOptions())
    await toOptionsStep(wrapper)
    expect(wrapper.findAll('select').length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain('Format')
  })

  it('shows profile dropdown for CSV format', async () => {
    const wrapper = mount(ExportModal, mountOptions())
    await toOptionsStep(wrapper)
    expect(wrapper.text()).toContain('Profile')
  })

  it('hides profile dropdown for JSON format', async () => {
    const wrapper = mount(ExportModal, mountOptions())
    await toOptionsStep(wrapper)
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('json')
    expect(wrapper.text()).not.toContain('Profile')
  })

  it('calls getExporter with selected format on export click', async () => {
    mockExport.mockResolvedValue({ playlistsExported: 1, errors: [] })

    const wrapper = mount(ExportModal, mountOptions())
    await toOptionsStep(wrapper)
    await wrapper.find('button.btn--primary').trigger('click')
    await flushPromises()

    expect(registry.getExporter).toHaveBeenCalledWith('csv')
    expect(mockExport).toHaveBeenCalled()
  })

  it('shows done state after export', async () => {
    mockExport.mockResolvedValue({ playlistsExported: 2, errors: [] })

    const wrapper = mount(ExportModal, mountOptions())
    await toOptionsStep(wrapper)
    await wrapper.find('button.btn--primary').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Export complete')
    expect(wrapper.find('button.btn--primary').exists()).toBe(false)
  })

  it('Cancel button emits cancel', async () => {
    const wrapper = mount(ExportModal, mountOptions())
    await wrapper.find('button.btn--secondary').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('hides Export button while exporting', async () => {
    mockExport.mockImplementation(() => new Promise(() => {})) // never resolves

    const wrapper = mount(ExportModal, mountOptions())
    await toOptionsStep(wrapper)
    await wrapper.find('button.btn--primary').trigger('click')

    // Step changes to 'progress' — Export button is gone
    expect(wrapper.find('button.btn--primary').exists()).toBe(false)
    expect(wrapper.text()).toContain('Exporting')
  })
})

