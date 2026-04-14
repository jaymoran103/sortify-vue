import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaylistColumnHeader from '@/components/workspace/PlaylistColumnHeader.vue'
import type { WorkspacePlaylist } from '@/types/models'
import type { MenuEntry } from '@/types/ui'

// ─── Mock useContextMenu ──────────────────────────────────────────────────────
// Replace the singleton with a fresh mock per test to avoid cross-test contamination.

const mockShow = vi.fn()
const mockClose = vi.fn()

vi.mock('@/composables/useContextMenu', () => ({
  useContextMenu: () => ({
    show: mockShow,
    close: mockClose,
    isOpen: { value: false },
    entries: { value: [] },
    position: { value: { x: 0, y: 0 } },
  }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlaylist(id: number, name: string): WorkspacePlaylist {
  return { id, name, trackIDs: [], trackIdSet: new Set(), origin: 'library' }
}

function mountHeader(playlist: WorkspacePlaylist, canMoveLeft = false, canMoveRight = false) {
  return mount(PlaylistColumnHeader, {
    props: { playlist, canMoveLeft, canMoveRight },
  })
}

function getLastShowLabels(): string[] {
  const lastCall = mockShow.mock.calls[mockShow.mock.calls.length - 1]
  const items: MenuEntry[] = lastCall?.[1] ?? []
  return items.filter((e): e is { label: string; action: () => void } => 'label' in e).map((e) => e.label)
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

  describe('context menu items', () => {
    let currentWrapper: ReturnType<typeof mountHeader> | null = null

    beforeEach(() => {
      mockShow.mockClear()
    })

    afterEach(() => {
      currentWrapper?.unmount()
      currentWrapper = null
    })

    it('opens context menu on button click', async () => {
      currentWrapper = mountHeader(makePlaylist(1, 'PL1'))
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      expect(mockShow).toHaveBeenCalledOnce()
    })

    it('always includes Rename and Duplicate items', async () => {
      currentWrapper = mountHeader(makePlaylist(1, 'PL1'))
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const labels = getLastShowLabels()
      expect(labels).toContain('Rename')
      expect(labels).toContain('Duplicate')
    })

    it('always includes Remove from Workspace item', async () => {
      currentWrapper = mountHeader(makePlaylist(1, 'PL1'))
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      expect(getLastShowLabels()).toContain('Remove from Workspace')
    })

    it('includes Move Left when canMoveLeft is true', async () => {
      currentWrapper = mountHeader(makePlaylist(1, 'PL1'), true, false)
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      expect(getLastShowLabels()).toContain('Move Left')
    })

    it('excludes Move Left when canMoveLeft is false', async () => {
      currentWrapper = mountHeader(makePlaylist(1, 'PL1'), false, false)
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      expect(getLastShowLabels()).not.toContain('Move Left')
    })

    it('includes Move Right when canMoveRight is true', async () => {
      currentWrapper = mountHeader(makePlaylist(1, 'PL1'), false, true)
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      expect(getLastShowLabels()).toContain('Move Right')
    })

    it('excludes Move Right when canMoveRight is false', async () => {
      currentWrapper = mountHeader(makePlaylist(1, 'PL1'), false, false)
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      expect(getLastShowLabels()).not.toContain('Move Right')
    })

    it('Rename action emits rename event with playlist id', async () => {
      currentWrapper = mountHeader(makePlaylist(7, 'PL'))
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const items: MenuEntry[] = mockShow.mock.calls[0]![1]!
      const renameItem = items.find((e) => 'label' in e && e.label === 'Rename')
      expect(renameItem).toBeDefined()
      if (renameItem && 'action' in renameItem) renameItem.action()
      expect(currentWrapper.emitted('rename')).toBeDefined()
      expect(currentWrapper.emitted('rename')![0]).toEqual([7])
    })

    it('Duplicate action emits duplicate event with playlist id', async () => {
      currentWrapper = mountHeader(makePlaylist(7, 'PL'))
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const items: MenuEntry[] = mockShow.mock.calls[0]![1]!
      const item = items.find((e) => 'label' in e && e.label === 'Duplicate')
      if (item && 'action' in item) item.action()
      expect(currentWrapper.emitted('duplicate')![0]).toEqual([7])
    })

    it('Remove action emits remove event with playlist id', async () => {
      currentWrapper = mountHeader(makePlaylist(7, 'PL'))
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const items: MenuEntry[] = mockShow.mock.calls[0]![1]!
      const item = items.find((e) => 'label' in e && e.label === 'Remove from Workspace')
      if (item && 'action' in item) item.action()
      expect(currentWrapper.emitted('remove')![0]).toEqual([7])
    })

    it('Move Left action emits moveLeft event', async () => {
      currentWrapper = mountHeader(makePlaylist(7, 'PL'), true, false)
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const items: MenuEntry[] = mockShow.mock.calls[0]![1]!
      const item = items.find((e) => 'label' in e && e.label === 'Move Left')
      if (item && 'action' in item) item.action()
      expect(currentWrapper.emitted('moveLeft')![0]).toEqual([7])
    })

    it('Move Right action emits moveRight event', async () => {
      currentWrapper = mountHeader(makePlaylist(7, 'PL'), false, true)
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const items: MenuEntry[] = mockShow.mock.calls[0]![1]!
      const item = items.find((e) => 'label' in e && e.label === 'Move Right')
      if (item && 'action' in item) item.action()
      expect(currentWrapper.emitted('moveRight')![0]).toEqual([7])
    })

    it('includes a divider before Remove from Workspace', async () => {
      currentWrapper = mountHeader(makePlaylist(1, 'PL'))
      await currentWrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const items: MenuEntry[] = mockShow.mock.calls[0]![1]!
      const removeIdx = items.findIndex((e) => 'label' in e && e.label === 'Remove from Workspace')
      expect(removeIdx).toBeGreaterThan(0)
      expect(items[removeIdx - 1]).toHaveProperty('divider', true)
    })
  })
})
