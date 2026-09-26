import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkspaceMinimap from '@/components/workspace/WorkspaceMinimap.vue'
import type { Track, WorkspacePlaylist } from '@/types/models'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTracks(n: number): Track[] {
  return Array.from({ length: n }, (_, i) => ({
    trackID: `t${i}`,
    title: `Song ${i}`,
    artist: 'Artist',
    album: 'Album',
    source: 'csv' as const,
  }))
}

function makePlaylist(id: number, trackIDs: string[]): WorkspacePlaylist {
  return { id, name: `PL${id}`, trackIDs, trackIdSet: new Set(trackIDs), origin: 'library' }
}

// jsdom does no layout, so scroll metrics are pinned by hand.
function makeScrollEl(scrollHeight: number, clientHeight: number): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight })
  return el
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WorkspaceMinimap', () => {
  // jsdom measures no height, so tiles sit at their 2px minimum side.
  it('gives each playlist one square tile of width', () => {
    const tracks = makeTracks(3)
    const two = mount(WorkspaceMinimap, {
      props: { tracks, playlists: [makePlaylist(1, []), makePlaylist(2, [])], scrollEl: null, rowHeight: 48 },
    })
    expect(two.attributes('style')).toContain('width: 4px')

    const many = Array.from({ length: 30 }, (_, i) => makePlaylist(i, []))
    const thirty = mount(WorkspaceMinimap, {
      props: { tracks, playlists: many, scrollEl: null, rowHeight: 48 },
    })
    expect(thirty.attributes('style')).toContain('width: 60px')
  })

  it('hides the viewport box when every track fits on screen', () => {
    const wrapper = mount(WorkspaceMinimap, {
      props: {
        tracks: makeTracks(5),
        playlists: [makePlaylist(1, ['t0'])],
        scrollEl: makeScrollEl(300, 600),
        rowHeight: 48,
      },
    })
    expect(wrapper.find('.minimap__viewport').exists()).toBe(false)
  })

  it('shows the viewport box when the table scrolls', () => {
    const wrapper = mount(WorkspaceMinimap, {
      props: {
        tracks: makeTracks(100),
        playlists: [makePlaylist(1, ['t0'])],
        scrollEl: makeScrollEl(4840, 600),
        rowHeight: 48,
      },
    })
    expect(wrapper.find('.minimap__viewport').exists()).toBe(true)
  })

  it('brightens while the table is scrolling', async () => {
    const scrollEl = makeScrollEl(4840, 600)
    const wrapper = mount(WorkspaceMinimap, {
      props: { tracks: makeTracks(100), playlists: [makePlaylist(1, [])], scrollEl, rowHeight: 48 },
    })
    expect(wrapper.classes()).not.toContain('minimap--active')
    scrollEl.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('minimap--active')
  })
})
