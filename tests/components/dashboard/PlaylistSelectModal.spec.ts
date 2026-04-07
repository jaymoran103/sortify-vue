import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHashHistory } from 'vue-router'
import PlaylistSelectModal from '@/components/dashboard/PlaylistSelectModal.vue'
import type { Playlist } from '@/types/models'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/workspace', component: { template: '<div />' } },
  ],
})

const playlists: Playlist[] = [
  { id: 1, name: 'Blues Mix', trackIDs: ['a', 'b'] },
  { id: 2, name: 'Rock Mix', trackIDs: ['c'] },
  { id: 3, name: 'Workout', trackIDs: [] },
]

vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({ playlists }),
}))


// Use html stub to to render all items directly: avoids virtualizer needing a DOM scroll container
// FUTURE: Ensure format matches actual ScrollableList usage and structure
const ScrollableListStub = {
  props: ['items', 'keyField', 'estimateSize', 'overscan'],
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
  return mount(PlaylistSelectModal, {
    global: {
      plugins: [router],
      stubs: {
        ScrollableList: ScrollableListStub,
      },
    },
  })
}

describe('PlaylistSelectModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders playlists as selectable items', () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain('Blues Mix')
    expect(wrapper.text()).toContain('Rock Mix')
    expect(wrapper.text()).toContain('Workout')
  })

  it('renders subtitle with trackIDs count', () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain('2 tracks')
    expect(wrapper.text()).toContain('1 tracks')
  })

  it('Cancel button emits cancel', async () => {
    const wrapper = mountModal()
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')!
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('confirm button disabled when nothing selected', () => {
    const wrapper = mountModal()
    const openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect((openBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('confirm button enabled after selecting an item', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')

    const openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect((openBtn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('clicking two items selects both (checkbox / multi-select semantics)', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')
    await items[1]!.trigger('click')

    const openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect(openBtn.text()).toContain('2')
  })

  it('clicking a selected item deselects it', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click') // select
    await items[0]!.trigger('click') // deselect

    const openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect((openBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows selected count in confirm button label', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')

    const openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect(openBtn.text()).toContain('1')
  })

  it('confirm navigates to /workspace with selected IDs and emits cancel', async () => {
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click')

    const openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    await openBtn.trigger('click')

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/workspace',
        query: expect.objectContaining({ playlists: '1' }),
      }),
    )
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('search filters playlists by name', async () => {
    const wrapper = mountModal()
    const searchInput = wrapper.find('input')
    await searchInput.setValue('blues') //Ensure name matches
    // Wait for debounce (200ms)
    await new Promise((r) => setTimeout(r, 250))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Blues Mix')
    expect(wrapper.findAll('.selectable-item').length).toBe(1)
  })

  it('renders a sort dropdown', () => {
    const wrapper = mountModal()
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('sort dropdown has Name and Track Count options', () => {
    const wrapper = mountModal()
    const options = wrapper.findAll('select option')
    const labels = options.map((o) => o.text())
    expect(labels).toContain('Name')
    expect(labels).toContain('Track Count')
  })

  it('renders Select All button', () => {
    const wrapper = mountModal()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Select All'))
    expect(btn).toBeTruthy()
  })

  it('Select All selects all visible items', async () => {
    const wrapper = mountModal()
    const selectAllBtn = wrapper.findAll('button').find((b) => b.text().includes('Select All'))!
    await selectAllBtn.trigger('click')

    const openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect(openBtn.text()).toContain('3')
  })

  it('Select All becomes Deselect All when all items are selected', async () => {
    const wrapper = mountModal()
    const selectAllBtn = wrapper.findAll('button').find((b) => b.text().includes('Select All'))!
    await selectAllBtn.trigger('click')

    const deselectBtn = wrapper.findAll('button').find((b) => b.text().includes('Deselect All'))
    expect(deselectBtn).toBeTruthy()
  })

  it('Deselect All clears selection', async () => {
    const wrapper = mountModal()
    const selectAllBtn = wrapper.findAll('button').find((b) => b.text().includes('Select All'))!
    await selectAllBtn.trigger('click')
    const deselectBtn = wrapper.findAll('button').find((b) => b.text().includes('Deselect All'))!
    await deselectBtn.trigger('click')

    const openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect((openBtn.element as HTMLButtonElement).disabled).toBe(true)
  })


  it ('Selection is preserved when filtering or sorting', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click') // select first item

    // Apply a filter that still includes the selected item
    const searchInput = wrapper.find('input')
    await searchInput.setValue('mix')
    await new Promise((r) => setTimeout(r, 250))
    await wrapper.vm.$nextTick()

    let openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect(openBtn.text()).toContain('1') // still 1 selected

    // Change sort order
    const sortSelect = wrapper.find('select')
    await sortSelect.setValue('trackCount')
    await wrapper.vm.$nextTick()

    openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect(openBtn.text()).toContain('1') // still 1 selected
  })  


  // NOTE: Should fail until selection updates are decoupled from display scope
  it ('Selections persist regardless of display scope)', async () => {
    const wrapper = mountModal()
    const items = wrapper.findAll('.selectable-item')
    await items[0]!.trigger('click') // select first item

    // Apply a filter that excludes the selected item
    const searchInput = wrapper.find('input')
    await searchInput.setValue('workout')
    await new Promise((r) => setTimeout(r, 250))
    await wrapper.vm.$nextTick()

    let openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect(openBtn.text()).toContain('1') // still 1 selected, even though it's filtered out

    // Change sort order
    const sortSelect = wrapper.find('select')
    await sortSelect.setValue('trackCount')
    await wrapper.vm.$nextTick()

    openBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Open'))!
    expect(openBtn.text()).toContain('1')
  })
})
