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

  // ─── Expand toggle ─────────────────────────────────────────────────────────

  describe('expand toggle', () => {
    it('emits toggleExpand with the playlist id on a header click', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'), false)
      await wrapper.find('.playlist-col-header').trigger('click')
      expect(wrapper.emitted('toggleExpand')).toEqual([[7]])
    })

    it('emits toggleExpand once when the toggle button itself is clicked', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'), false)
      await wrapper.find('.playlist-col-header__toggle').trigger('click')
      expect(wrapper.emitted('toggleExpand')).toEqual([[7]])
    })

    it('does not toggle when the ellipsis button is clicked', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      expect(wrapper.emitted('toggleExpand')).toBeUndefined()
    })

    it('reports its state through aria-expanded', () => {
      expect(
        mountHeader(makePlaylist(1, 'PL'), true).find('.playlist-col-header__toggle').attributes('aria-expanded'),
      ).toBe('true')
      expect(
        mountHeader(makePlaylist(1, 'PL'), false).find('.playlist-col-header__toggle').attributes('aria-expanded'),
      ).toBe('false')
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

  // ─── Drag to reorder ───────────────────────────────────────────────────────
  // The header hops one column each time the pointer passes a neighbour's midpoint.

  describe('drag to reorder', () => {
    // Mounts the header between two fake neighbour headers, each 48px wide: prev at
    // 0-48, this one at 48-96, next at 96-144. jsdom lays nothing out, so rects are stubbed.
    function mountBetweenNeighbours() {
      const row = document.createElement('div')
      document.body.appendChild(row)
      const wrapper = mount(PlaylistColumnHeader, {
        props: { playlist: makePlaylist(7, 'PL'), expanded: false },
        attachTo: row,
      })
      // The template's leading comments make the root a fragment, so find the header.
      const header = wrapper.find('.playlist-col-header')
      const parent = header.element.parentElement!
      parent.insertBefore(neighbour(0), header.element)
      parent.appendChild(neighbour(96))
      return { wrapper, header }
    }

    function neighbour(left: number): HTMLElement {
      const el = document.createElement('div')
      el.className = 'playlist-col-header'
      el.getBoundingClientRect = () => ({ left, width: 48 }) as DOMRect
      return el
    }

    // trigger() cannot set a MouseEvent's button, so the press is dispatched by hand.
    function press(el: Element, button: number): void {
      el.dispatchEvent(new MouseEvent('pointerdown', { button, clientX: 72, bubbles: true }))
    }

    function pointer(type: string, clientX: number): void {
      window.dispatchEvent(new MouseEvent(type, { clientX }))
    }

    it('moves right once the pointer passes the next header’s midpoint', async () => {
      const { wrapper, header } = mountBetweenNeighbours()
      press(header.element, 0)
      pointer('pointermove', 110)
      expect(wrapper.emitted('move')).toBeUndefined()
      pointer('pointermove', 125)
      expect(wrapper.emitted('move')).toEqual([[7, 1]])
      pointer('pointerup', 125)
      expect(wrapper.emitted('dragEnd')).toEqual([[7]])
      wrapper.unmount()
    })

    it('moves left once the pointer passes the previous header’s midpoint', async () => {
      const { wrapper, header } = mountBetweenNeighbours()
      press(header.element, 0)
      pointer('pointermove', 20)
      expect(wrapper.emitted('move')).toEqual([[7, -1]])
      pointer('pointerup', 20)
      wrapper.unmount()
    })

    it('treats a press that barely moves as a click', async () => {
      const { wrapper, header } = mountBetweenNeighbours()
      press(header.element, 0)
      pointer('pointermove', 74)
      pointer('pointerup', 74)
      await header.trigger('click')
      expect(wrapper.emitted('toggleExpand')).toEqual([[7]])
      expect(wrapper.emitted('dragEnd')).toBeUndefined()
      wrapper.unmount()
    })

    it('does not toggle the column on the click that ends a drag', async () => {
      const { wrapper, header } = mountBetweenNeighbours()
      press(header.element, 0)
      pointer('pointermove', 80)
      pointer('pointerup', 80)
      await header.trigger('click')
      expect(wrapper.emitted('toggleExpand')).toBeUndefined()
      await header.trigger('click')
      expect(wrapper.emitted('toggleExpand')).toEqual([[7]])
      wrapper.unmount()
    })

    it('ignores a right-button press', async () => {
      const { wrapper, header } = mountBetweenNeighbours()
      press(header.element, 2)
      pointer('pointermove', 125)
      expect(wrapper.emitted('move')).toBeUndefined()
      wrapper.unmount()
    })
  })
})
