import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaylistColumnHeader from '@/components/workspace/PlaylistColumnHeader.vue'
import type { WorkspacePlaylist } from '@/types/models'

// The header is presentational: it renders the playlist and reports menu requests.
// Menu *content* is assembled by WorkspaceView, so those assertions live in
// tests/components/workspace/WorkspaceView.spec.ts (design decision D1).

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlaylist(id: number, name: string, trackIDs: string[] = []): WorkspacePlaylist {
  return { id, name, trackIDs, trackIdSet: new Set(trackIDs), origin: 'library' }
}

function mountHeader(playlist: WorkspacePlaylist) {
  return mount(PlaylistColumnHeader, {
    props: { playlist },
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlaylistColumnHeader', () => {
  it('renders playlist name', () => {
    const wrapper = mountHeader(makePlaylist(1, 'Morning Mix'))
    expect(wrapper.find('.playlist-col-header__name').text()).toBe('Morning Mix')
  })

  it('title attribute matches playlist name for long names', () => {
    const wrapper = mountHeader(makePlaylist(1, 'My Very Long Playlist Name'))
    expect(wrapper.find('.playlist-col-header__name').attributes('title')).toBe(
      'My Very Long Playlist Name',
    )
  })

  it('menu button exists with accessible label', () => {
    const wrapper = mountHeader(makePlaylist(1, 'PL1'))
    const btn = wrapper.find('.playlist-col-header__menu-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toBe('Playlist actions')
  })

  describe('track count', () => {
    it('renders a pluralised track count', () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL', ['t1', 't2', 't3']))
      expect(wrapper.find('.playlist-col-header__count').text()).toBe('3 tracks')
    })

    it('renders the singular form for exactly one track', () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL', ['t1']))
      expect(wrapper.find('.playlist-col-header__count').text()).toBe('1 track')
    })

    it('renders zero tracks as a plural', () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL'))
      expect(wrapper.find('.playlist-col-header__count').text()).toBe('0 tracks')
    })

    it('updates reactively when the playlist track list changes', async () => {
      const playlist = makePlaylist(1, 'PL', ['t1'])
      const wrapper = mountHeader(playlist)
      expect(wrapper.find('.playlist-col-header__count').text()).toBe('1 track')
      await wrapper.setProps({ playlist: makePlaylist(1, 'PL', ['t1', 't2']) })
      expect(wrapper.find('.playlist-col-header__count').text()).toBe('2 tracks')
    })
  })

  describe('menu requests', () => {
    it('emits requestMenu with the playlist id when the ellipsis button is clicked', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const emitted = wrapper.emitted('requestMenu') as [number, MouseEvent][]
      expect(emitted).toBeDefined()
      expect(emitted[0]![0]).toBe(7)
    })

    it('passes the originating event so the parent can position the menu', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const emitted = wrapper.emitted('requestMenu') as [number, MouseEvent][]
      expect(emitted[0]![1]).toBeInstanceOf(Event)
    })

    it('emits requestMenu on right-click anywhere on the header', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'))
      await wrapper.find('.playlist-col-header').trigger('contextmenu')
      const emitted = wrapper.emitted('requestMenu') as [number, MouseEvent][]
      expect(emitted).toBeDefined()
      expect(emitted[0]![0]).toBe(7)
    })

    it('does not emit until a trigger fires', () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'))
      expect(wrapper.emitted('requestMenu')).toBeUndefined()
    })
  })
})
