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

function mountModal(props: Record<string, unknown> = {}) {
  return mount(TrackSelectModal, {
    props,
    global: {
      stubs: { ScrollableList: ScrollableListStub },
    },
  })
}

// The confirm button's label and variant are caller-supplied, so locate it by its
// stable BEM class rather than by text.
function confirmBtn(wrapper: ReturnType<typeof mountModal>) {
  return wrapper.find('.track-select__confirm')
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

  it('confirm button is disabled when nothing is selected', () => {
    const wrapper = mountModal()
    const btn = confirmBtn(wrapper)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('confirm button is enabled after selecting a track', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    const btn = confirmBtn(wrapper)
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows selected count in the confirm button label', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    await items[1]!.trigger('click')
    const btn = confirmBtn(wrapper)
    expect(btn.text()).toContain('2')
  })

  it('clicking a selected track deselects it', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    await items[0]!.trigger('click')
    const btn = confirmBtn(wrapper)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits confirm with selected trackIDs on confirm click', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    const btn = confirmBtn(wrapper)
    await btn.trigger('click')
    const emitted = wrapper.emitted('confirm') as [string[]][]
    expect(emitted).toBeTruthy()
    expect(emitted[0]![0]).toContain('t1')
  })

  it('Select All selects every track', async () => {
    const wrapper = mountModal()
    const selectAllBtn = wrapper.find('.track-select__select-all')
    await selectAllBtn.trigger('click')
    const btn = confirmBtn(wrapper)
    expect(btn.text()).toContain('3')
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
    const btn = confirmBtn(wrapper)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  // ─── Neutral defaults ───────────────────────────────────────────────────────
  // Destructive styling is opt-in: a caller that forgets the props gets a plain
  // Confirm button, not a red Delete one.

  describe('confirm label and variant', () => {
    it('defaults to a neutral Confirm label and primary variant', () => {
      const wrapper = mountModal()
      const btn = confirmBtn(wrapper)
      expect(btn.text()).toContain('Confirm')
      expect(btn.classes()).toContain('btn--primary')
      expect(btn.classes()).not.toContain('btn--danger')
    })

    it('applies an explicit confirmLabel and danger variant', () => {
      const wrapper = mountModal({ confirmLabel: 'Delete', confirmVariant: 'danger' })
      const btn = confirmBtn(wrapper)
      expect(btn.text()).toContain('Delete')
      expect(btn.classes()).toContain('btn--danger')
      expect(btn.classes()).not.toContain('btn--primary')
    })
  })

  // ─── excludeIds ─────────────────────────────────────────────────────────────
  // Filtering happens ahead of the filter/sort pipeline, so the count, Select All,
  // and the selected-first display all agree on the same candidate set.

  describe('excludeIds', () => {
    it('excludes listed tracks from the candidate list', () => {
      const wrapper = mountModal({ excludeIds: ['t1'] })
      expect(wrapper.text()).not.toContain('Blue Monday')
      expect(wrapper.text()).toContain('Sweet Home')
      expect(wrapper.text()).toContain('Bohemian')
    })

    it('Select All only selects candidates that survived excludeIds', async () => {
      const wrapper = mountModal({ excludeIds: ['t1'] })
      await wrapper.find('.track-select__select-all').trigger('click')
      expect(confirmBtn(wrapper).text()).toContain('2')
    })

    it('emits confirm with only non-excluded ids', async () => {
      const wrapper = mountModal({ excludeIds: ['t1'] })
      await wrapper.find('.track-select__select-all').trigger('click')
      await confirmBtn(wrapper).trigger('click')
      const emitted = wrapper.emitted('confirm') as [string[]][]
      expect(emitted[0]![0]).toEqual(expect.arrayContaining(['t2', 't3']))
      expect(emitted[0]![0]).not.toContain('t1')
    })

    it('shows the empty slot when every track is excluded', () => {
      const wrapper = mountModal({ excludeIds: ['t1', 't2', 't3'] })
      expect(wrapper.find('.track-select__empty').exists()).toBe(true)
    })
  })

  // W1-H specified a "No New Tracks" pre-check before opening the picker. D3 replaced it with
  // excludeIds, which left the all-excluded case falling through to the search-flavoured copy —
  // telling the user their search found nothing when they had not searched.
  describe('empty-state wording', () => {
    const allExcluded = ['t1', 't2', 't3']

    it('blames the exclusion, not a search, when nothing was typed', () => {
      const wrapper = mountModal({
        excludeIds: allExcluded,
        excludedEmptyLabel: 'All library tracks are already in this workspace.',
      })
      expect(wrapper.find('.track-select__empty').text()).toBe(
        'All library tracks are already in this workspace.',
      )
      expect(wrapper.text()).not.toContain('No matching tracks')
    })

    it('carries a neutral default when the caller supplies no label', () => {
      const wrapper = mountModal({ excludeIds: allExcluded })
      expect(wrapper.find('.track-select__empty').text()).toBe('No tracks available to select.')
    })

    it('blames the search once the user has actually typed', async () => {
      const wrapper = mountModal({
        excludeIds: allExcluded,
        excludedEmptyLabel: 'All library tracks are already in this workspace.',
      })
      await wrapper.find('.search-bar__input').setValue('zzz')
      expect(wrapper.find('.track-select__empty').text()).toBe('No matching tracks')
    })

    it('still blames the search when nothing was excluded', async () => {
      const wrapper = mountModal()
      await wrapper.find('.search-bar__input').setValue('zzz')
      await new Promise((r) => setTimeout(r, 250))
      expect(wrapper.find('.track-select__empty').text()).toBe('No matching tracks')
    })
  })
})
