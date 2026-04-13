import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrackRow from '@/components/workspace/TrackRow.vue'
import type { Track } from '@/types/models'
import type { WorkspacePlaylist } from '@/types/models'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTrack(trackID: string, title: string, artist: string): Track {
  return { trackID, title, artist, album: 'Album', source: 'csv' }
}

function makePlaylist(id: number, name: string, trackIDs: string[]): WorkspacePlaylist {
  return { id, name, trackIDs, trackIdSet: new Set(trackIDs), origin: 'library' }
}

function mountRow(
  track: Track,
  index: number,
  playlists: WorkspacePlaylist[],
) {
  return mount(TrackRow, { props: { track, index, playlists } })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TrackRow', () => {
  it('renders track title', () => {
    const wrapper = mountRow(makeTrack('t1', 'My Song', 'My Artist'), 0, [])
    expect(wrapper.find('.track-row__title').text()).toBe('My Song')
  })

  it('renders track artist', () => {
    const wrapper = mountRow(makeTrack('t1', 'My Song', 'My Artist'), 0, [])
    expect(wrapper.find('.track-row__artist').text()).toBe('My Artist')
  })

  it('renders 1-based row index', () => {
    const wrapper = mountRow(makeTrack('t1', 'Song', 'Artist'), 2, [])
    expect(wrapper.find('.track-row__index').text()).toBe('3')
  })

  it('renders a checkbox for each playlist', () => {
    const playlists = [makePlaylist(1, 'PL1', []), makePlaylist(2, 'PL2', [])]
    const wrapper = mountRow(makeTrack('t1', 'Song', 'Artist'), 0, playlists)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
  })

  it('checkbox is checked when track is in the playlist trackIdSet', () => {
    const pl = makePlaylist(1, 'PL1', ['t1'])
    const wrapper = mountRow(makeTrack('t1', 'Song', 'Artist'), 0, [pl])
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('checkbox is unchecked when track is not in the playlist trackIdSet', () => {
    const pl = makePlaylist(1, 'PL1', [])
    const wrapper = mountRow(makeTrack('t1', 'Song', 'Artist'), 0, [pl])
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  })

  it('checkbox checked state uses trackIdSet not trackIDs array', () => {
    const pl = makePlaylist(1, 'PL1', ['t1'])
    // Override trackIdSet so it disagrees with trackIDs
    pl.trackIdSet = new Set<string>()
    const wrapper = mountRow(makeTrack('t1', 'Song', 'Artist'), 0, [pl])
    const checkbox = wrapper.find('input[type="checkbox"]')
    // Checked state must reflect trackIdSet, not trackIDs
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  })

  it('checkbox change emits toggleTrack with playlist id and track id', async () => {
    const pl = makePlaylist(42, 'PL1', ['t1'])
    const wrapper = mountRow(makeTrack('t1', 'Song', 'Artist'), 0, [pl])
    await wrapper.find('input[type="checkbox"]').trigger('change')
    expect(wrapper.emitted('toggleTrack')).toBeDefined()
    expect(wrapper.emitted('toggleTrack')![0]).toEqual([42, 't1'])
  })

  it('checkbox has accessible aria-label', () => {
    const pl = makePlaylist(1, 'My Playlist', ['t1'])
    const wrapper = mountRow(makeTrack('t1', 'Great Song', 'Artist'), 0, [pl])
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.attributes('aria-label')).toBe('Great Song in My Playlist')
  })
})
