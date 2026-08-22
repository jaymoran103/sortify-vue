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

function mountHeader(playlist: WorkspacePlaylist, expanded = true) {
  return mount(PlaylistColumnHeader, {
    props: { playlist, expanded },
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

    // Zero pluralises like any other count, and carries the empty marker alongside it.
    it('renders zero tracks as a plural, with the empty marker', () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL'))
      expect(wrapper.find('.playlist-col-header__count').text()).toBe('⚠ 0 tracks')
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

  // ─── Empty marker ──────────────────────────────────────────────────────────
  // An empty column is flagged here for the whole session, so the leave dialog is a
  // summary of something already on screen rather than a surprise on the way out.

  describe('empty playlist marker', () => {
    it('marks a column with no tracks', () => {
      const wrapper = mountHeader(makePlaylist(1, 'Morning Mix', []))
      expect(wrapper.find('.playlist-col-header__count').classes()).toContain(
        'playlist-col-header__count--empty',
      )
    })

    it('leaves a populated column unmarked', () => {
      const wrapper = mountHeader(makePlaylist(1, 'Morning Mix', ['t1']))
      expect(wrapper.find('.playlist-col-header__count').classes()).not.toContain(
        'playlist-col-header__count--empty',
      )
    })

    it('still reports the count itself', () => {
      const wrapper = mountHeader(makePlaylist(1, 'Morning Mix', []))
      expect(wrapper.find('.playlist-col-header__count').text()).toContain('0 tracks')
    })
  })

  // ─── Collapsed ─────────────────────────────────────────────────────────────
  // A collapsed column is one square cell wide, so only initials fit.

  describe('collapsed', () => {
    it('shows initials in place of the name, count and menu button', () => {
      const wrapper = mountHeader(makePlaylist(1, 'Road Trip Mix', ['t1']), false)
      expect(wrapper.find('.playlist-col-header__initials').text()).toContain('RT')
      expect(wrapper.find('.playlist-col-header__name').exists()).toBe(false)
      expect(wrapper.find('.playlist-col-header__count').exists()).toBe(false)
      expect(wrapper.find('.playlist-col-header__menu-btn').exists()).toBe(false)
    })

    it('keeps the full name as a tooltip and for screen readers', () => {
      const wrapper = mountHeader(makePlaylist(1, 'Road Trip Mix', ['t1']), false)
      const label = wrapper.find('.playlist-col-header__initials')
      expect(label.attributes('title')).toBe('Road Trip Mix')
      expect(label.find('.sr-only').text()).toBe('Road Trip Mix')
    })

    it('still flags an empty playlist, in colour and in words', () => {
      const wrapper = mountHeader(makePlaylist(1, 'Morning Mix', []), false)
      const label = wrapper.find('.playlist-col-header__initials')
      expect(label.classes()).toContain('playlist-col-header__initials--empty')
      expect(label.find('.sr-only').text()).toBe('Morning Mix, empty')
    })

    it('still emits requestMenu on right-click', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'), false)
      await wrapper.find('.playlist-col-header').trigger('contextmenu')
      expect(wrapper.emitted('requestMenu')).toBeDefined()
    })
  })
})
