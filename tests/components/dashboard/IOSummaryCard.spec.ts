import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import IOSummaryCard from '@/components/dashboard/IOSummaryCard.vue'
import { useActivityStore } from '@/stores/activity'
import type { ActivityItem } from '@/types/ui'

// Stub ErrorSummary to avoid rendering its internals
vi.mock('@/components/common/ErrorSummary.vue', () => ({
  default: {
    name: 'ErrorSummary',
    template: '<div class="error-summary"></div>',
    props: ['errors'],
  },
}))

function makeItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'op1',
    label: 'Test Operation',
    status: 'done',
    progress: null,
    errors: [],
    startedAt: Date.now(),
    completedAt: Date.now(),
    ...overrides,
  }
}

function mountCard() {
  return mount(IOSummaryCard, {
    global: { plugins: [createPinia()] },
  })
}

describe('IOSummaryCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders nothing when history is empty', () => {
    const wrapper = mountCard()
    expect(wrapper.find('.io-summary-card').exists()).toBe(false)
  })

  it('renders one row per history item', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a' }))
    store.history.push(makeItem({ id: 'b' }))
    store.history.push(makeItem({ id: 'c' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.io-summary-card__row')).toHaveLength(3)
  })

  it('row label uses SOURCE_LABELS when source is set', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a', source: 'spotify-import' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card__row-label').text()).toBe('Spotify Import')
  })

  it('row label falls back to op.label when no source is set', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a', label: 'Custom Operation' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card__row-label').text()).toBe('Custom Operation')
  })

  it('summary counts display in the expanded area, not the collapsed row', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({
      id: 'a',
      summary: { tracks: 42, playlists: 3, warnings: 1 },
    }))
    await wrapper.vm.$nextTick()
    // Collapsed row should not contain counts
    expect(wrapper.find('.io-summary-card__row-main').text()).not.toContain('42 tracks')
    // Expand to see counts
    await wrapper.find('.io-summary-card__expand-btn').trigger('click')
    await wrapper.vm.$nextTick()
    const detail = wrapper.find('.io-summary-card__details').text()
    expect(detail).toContain('42 tracks')
    expect(detail).toContain('3 playlists')
    expect(detail).toContain('1 warning')
  })

  it('dismiss button removes the row', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.io-summary-card__row')).toHaveLength(1)
    await wrapper.find('.io-summary-card__dismiss-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card').exists()).toBe(false)
  })

  it('clear all button removes all rows', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a' }))
    store.history.push(makeItem({ id: 'b' }))
    await wrapper.vm.$nextTick()
    await wrapper.find('.io-summary-card__clear-all').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card').exists()).toBe(false)
  })

  it('shows 3 rows by default and show-more button when there are 4+ items', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    for (let i = 0; i < 4; i++) {
      store.history.push(makeItem({ id: `op${i}`, completedAt: Date.now() - i }))
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.io-summary-card__row')).toHaveLength(3)
    expect(wrapper.find('.io-summary-card__show-more').exists()).toBe(true)
    expect(wrapper.find('.io-summary-card__show-more').text()).toContain('1 more')
  })

  it('show-more button reveals all rows and changes to show-less label', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    for (let i = 0; i < 5; i++) {
      store.history.push(makeItem({ id: `op${i}`, completedAt: Date.now() - i }))
    }
    await wrapper.vm.$nextTick()
    await wrapper.find('.io-summary-card__show-more').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.io-summary-card__row')).toHaveLength(5)
    expect(wrapper.find('.io-summary-card__show-more').text()).toContain('Show less')
  })

  it('expand button is always present regardless of errors or link items', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a', errors: [] }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card__expand-btn').exists()).toBe(true)
  })

  it('status label shows "Done with warnings" when done and warnings present', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a', summary: { warnings: 2 } }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card__row-status').text()).toBe('Done with warnings')
  })

  it('status label shows "Done" when done and no warnings', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card__row-status').text()).toBe('Done')
  })

  it('status label shows "Failed" when operation errored', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({
      id: 'a',
      status: 'error',
      errors: [{ category: 'error', message: 'Oops', items: [] }],
    }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card__row-status').text()).toBe('Failed')
  })

  it('expanding a row with no summary or errors shows empty details area', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({ id: 'a' }))
    await wrapper.vm.$nextTick()
    await wrapper.find('.io-summary-card__expand-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.io-summary-card__details').exists()).toBe(true)
  })

  it('clicking expand button renders ErrorSummary when errors present', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({
      id: 'a',
      errors: [{ category: 'warning', message: 'Something', items: [] }],
    }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.error-summary').exists()).toBe(false)
    await wrapper.find('.io-summary-card__expand-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.error-summary').exists()).toBe(true)
  })

  it('link items render as anchors in expanded detail', async () => {
    const wrapper = mountCard()
    const store = useActivityStore()
    store.history.push(makeItem({
      id: 'a',
      summary: {
        linkItems: [
          { label: 'My Playlist', href: 'https://open.spotify.com/playlist/abc123' },
        ],
      },
    }))
    await wrapper.vm.$nextTick()
    // Expand the row (button present because linkItems exist)
    await wrapper.find('.io-summary-card__expand-btn').trigger('click')
    await wrapper.vm.$nextTick()
    const link = wrapper.find('.io-summary-card__link-item a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://open.spotify.com/playlist/abc123')
    expect(link.text()).toBe('My Playlist')
  })
})
