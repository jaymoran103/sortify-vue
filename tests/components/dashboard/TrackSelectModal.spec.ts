import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TrackSelectModal from '@/components/dashboard/TrackSelectModal.vue'
import type { Track } from '@/types/models'

const tracks: Track[] = [
  { trackID: 't1', title: 'Blue Monday', artist: 'New Order', album: 'Power', source: 'csv' },
  { trackID: 't2', title: 'Sweet Home', artist: 'Lynyrd Skynyrd', album: 'Second', source: 'csv' },
  { trackID: 't3', title: 'Bohemian', artist: 'Queen', album: 'Night', source: 'csv' },
]

vi.mock('@/stores/tracks', () => ({
  useTrackStore: () => ({ tracks }),
}))

const ScrollableListStub = {
  props: ['items', 'keyField', 'estimateSize'],
  template: `
    <div>
      <template v-if="items.length === 0">
        <slot name="empty" />
      </template>
      <template v-else>
        <template v-for="(item, index) in items" :key="index">
          <slot name="item" :item="item" :index="index" />
        </template>
      </template>
    </div>
  `,
}

function mountModal() {
  return mount(TrackSelectModal, {
    global: {
      stubs: { ScrollableList: ScrollableListStub },
    },
  })
}

describe('TrackSelectModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders track titles as selectable items', () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain('Blue Monday')
    expect(wrapper.text()).toContain('Sweet Home')
    expect(wrapper.text()).toContain('Bohemian')
  })

  it('renders artist as subtitle for each track', () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain('New Order')
    expect(wrapper.text()).toContain('Lynyrd Skynyrd')
  })

  it('Cancel button emits cancel', async () => {
    const wrapper = mountModal()
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')!
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('Delete button is disabled when nothing is selected', () => {
    const wrapper = mountModal()
    const deleteBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Delete'))!
    expect((deleteBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Delete button is enabled after selecting a track', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    const deleteBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Delete'))!
    expect((deleteBtn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows selected count in Delete button label', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    await items[1]!.trigger('click')
    const deleteBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Delete'))!
    expect(deleteBtn.text()).toContain('2')
  })

  it('clicking a selected track deselects it', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    await items[0]!.trigger('click')
    const deleteBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Delete'))!
    expect((deleteBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits confirm with selected trackIDs on Delete click', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    const deleteBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Delete'))!
    await deleteBtn.trigger('click')
    const emitted = wrapper.emitted('confirm') as [string[]][]
    expect(emitted).toBeTruthy()
    expect(emitted[0]![0]).toContain('t1')
  })

  it('Select All selects every track', async () => {
    const wrapper = mountModal()
    const selectAllBtn = wrapper.find('.track-select__select-all')
    await selectAllBtn.trigger('click')
    const deleteBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Delete'))!
    expect(deleteBtn.text()).toContain('3')
  })

  it('Select All becomes Deselect All when all are selected', async () => {
    const wrapper = mountModal()
    const selectAllBtn = wrapper.find('.track-select__select-all')
    await selectAllBtn.trigger('click')
    expect(selectAllBtn.text()).toBe('Deselect All')
  })

  it('Deselect All clears the selection', async () => {
    const wrapper = mountModal()
    const selectAllBtn = wrapper.find('.track-select__select-all')
    await selectAllBtn.trigger('click') // select all
    await selectAllBtn.trigger('click') // deselect all
    const deleteBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Delete'))!
    expect((deleteBtn.element as HTMLButtonElement).disabled).toBe(true)
  })
})
