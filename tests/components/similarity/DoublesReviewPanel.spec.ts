import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DoublesReviewPanel from '@/components/similarity/DoublesReviewPanel.vue'
import type { EquivalenceGroup, Playlist, Track } from '@/types/models'

const TRACKS = new Map<string, Track>([
  ['a', { trackID: 'a', title: 'Respect', artist: 'Aretha Franklin', album: 'I Never Loved a Man', source: 'csv' }],
  ['b', { trackID: 'b', title: 'Respect - Live', artist: 'Aretha Franklin', album: 'Aretha in Paris', source: 'csv' }],
  ['c', { trackID: 'c', title: 'Respect', artist: 'Otis Redding', album: 'Very Best Of', source: 'csv' }],
])

const PLAYLISTS: Playlist[] = [
  { id: 1, name: 'Soul', trackIDs: ['a'] },
  { id: 2, name: 'Live Sets', trackIDs: ['b'] },
  { id: 3, name: 'Unrelated', trackIDs: ['zzz'] },
]

const GROUP: EquivalenceGroup = {
  id: 7,
  trackIds: ['a', 'b', 'c'],
  status: 'unconfirmed',
  matchTier: 'moderate',
  detectedAt: 1,
}

function factory(group: EquivalenceGroup = GROUP) {
  return mount(DoublesReviewPanel, {
    props: { group, tracks: TRACKS, playlists: PLAYLISTS, position: { index: 0, total: 4 } },
  })
}

describe('DoublesReviewPanel', () => {
  it('renders one row per variant', () => {
    const rows = factory().findAll('.doubles-panel__row:not(.doubles-panel__row--head)')
    expect(rows).toHaveLength(3)
  })

  it('says Doubles, not Equivalents', () => {
    expect(factory().text()).toContain('Doubles:')
    expect(factory().text()).not.toContain('Equivalent')
  })

  it('shows where it is in the review queue', () => {
    expect(factory().text()).toContain('group 1 of 4')
  })

  it('marks the first variant as the one to keep when none is preferred', () => {
    const wrapper = factory()
    expect(wrapper.find('.doubles-panel__keep-badge').text()).toBe('Keep')
    expect(wrapper.find('.doubles-panel__row--preferred').text()).toContain('Respect')
  })

  it('honours an explicitly preferred variant', () => {
    const wrapper = factory({ ...GROUP, preferredTrackId: 'b' })
    expect(wrapper.find('.doubles-panel__row--preferred').text()).toContain('Live')
  })

  it('shows the preferred variant as Source and the rest at the group tier', () => {
    const tiers = factory().findAll('.doubles-panel__tier').map((n) => n.text())
    expect(tiers[0]).toBe('Source')
    expect(tiers[1]).toBe('Moderate')
  })

  it('builds matrix columns only from playlists holding a variant', () => {
    const headers = factory().findAll('.doubles-panel__row--head .doubles-panel__cell--playlist')
    expect(headers.map((h) => h.text())).toEqual(['Soul', 'Live Sets'])
  })

  it('ticks the playlists each variant actually appears in', () => {
    const wrapper = factory()
    const firstRow = wrapper.findAll('.doubles-panel__row:not(.doubles-panel__row--head)')[0]!
    const marks = firstRow.findAll('.doubles-panel__mark')
    expect(marks[0]!.classes()).toContain('doubles-panel__mark--on')
    expect(marks[1]!.classes()).not.toContain('doubles-panel__mark--on')
  })

  it('emits prefer with the chosen variant', async () => {
    const wrapper = factory()
    await wrapper.findAll('.doubles-panel__prefer')[0]!.trigger('click')
    expect(wrapper.emitted('prefer')?.[0]?.[0]).toBe('b')
  })

  it('emits each review action', async () => {
    const wrapper = factory()
    await wrapper.find('.doubles-panel__confirm').trigger('click')
    await wrapper.find('.doubles-panel__reject').trigger('click')
    await wrapper.find('.doubles-panel__next').trigger('click')
    await wrapper.find('.doubles-panel__consolidate').trigger('click')
    await wrapper.find('.doubles-panel__approve-all').trigger('click')
    await wrapper.find('.doubles-panel__rescan').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('reject')).toHaveLength(1)
    expect(wrapper.emitted('next')).toHaveLength(1)
    expect(wrapper.emitted('consolidate')).toHaveLength(1)
    expect(wrapper.emitted('approveAll')).toHaveLength(1)
    expect(wrapper.emitted('rescan')).toHaveLength(1)
  })

  it('falls back to the track id when the track table has no record', () => {
    const wrapper = factory({ ...GROUP, trackIds: ['a', 'missing'] })
    expect(wrapper.text()).toContain('missing')
  })
})
