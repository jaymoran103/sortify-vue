import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaylistColumnHeader from '@/components/workspace/PlaylistColumnHeader.vue'
import { useContextMenu } from '@/composables/useContextMenu'
import type { WorkspacePlaylist } from '@/types/models'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlaylist(id: number, name: string): WorkspacePlaylist {
  return { id, name, trackIDs: [], trackIdSet: new Set(), origin: 'library' }
}

function mountHeader(playlist: WorkspacePlaylist, canMoveLeft = false, canMoveRight = false) {
  return mount(PlaylistColumnHeader, {
    props: { playlist, canMoveLeft, canMoveRight },
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

  describe('context menu items', () => {
    let ctx: ReturnType<typeof useContextMenu>

    beforeEach(() => {
      ctx = useContextMenu()
      ctx.close()
    })

    it('opens context menu on button click', async () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL1'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      expect(ctx.isOpen.value).toBe(true)
    })

    it('always includes Rename and Duplicate items', async () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL1'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const labels = ctx.entries.value
        .filter((e) => 'label' in e)
        .map((e) => ('label' in e ? e.label : ''))
      expect(labels).toContain('Rename')
      expect(labels).toContain('Duplicate')
    })

    it('always includes Remove from Workspace item', async () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL1'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const labels = ctx.entries.value
        .filter((e) => 'label' in e)
        .map((e) => ('label' in e ? e.label : ''))
      expect(labels).toContain('Remove from Workspace')
    })

    it('includes Move Left when canMoveLeft is true', async () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL1'), true, false)
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const labels = ctx.entries.value
        .filter((e) => 'label' in e)
        .map((e) => ('label' in e ? e.label : ''))
      expect(labels).toContain('Move Left')
    })

    it('excludes Move Left when canMoveLeft is false', async () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL1'), false, false)
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const labels = ctx.entries.value
        .filter((e) => 'label' in e)
        .map((e) => ('label' in e ? e.label : ''))
      expect(labels).not.toContain('Move Left')
    })

    it('includes Move Right when canMoveRight is true', async () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL1'), false, true)
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const labels = ctx.entries.value
        .filter((e) => 'label' in e)
        .map((e) => ('label' in e ? e.label : ''))
      expect(labels).toContain('Move Right')
    })

    it('excludes Move Right when canMoveRight is false', async () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL1'), false, false)
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const labels = ctx.entries.value
        .filter((e) => 'label' in e)
        .map((e) => ('label' in e ? e.label : ''))
      expect(labels).not.toContain('Move Right')
    })

    it('Rename action emits rename event with playlist id', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const renameItem = ctx.entries.value.find((e) => 'label' in e && e.label === 'Rename')
      expect(renameItem).toBeDefined()
      if (renameItem && 'action' in renameItem) renameItem.action()
      expect(wrapper.emitted('rename')).toBeDefined()
      expect(wrapper.emitted('rename')![0]).toEqual([7])
    })

    it('Duplicate action emits duplicate event with playlist id', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const item = ctx.entries.value.find((e) => 'label' in e && e.label === 'Duplicate')
      if (item && 'action' in item) item.action()
      expect(wrapper.emitted('duplicate')![0]).toEqual([7])
    })

    it('Remove action emits remove event with playlist id', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const item = ctx.entries.value.find(
        (e) => 'label' in e && e.label === 'Remove from Workspace',
      )
      if (item && 'action' in item) item.action()
      expect(wrapper.emitted('remove')![0]).toEqual([7])
    })

    it('Move Left action emits moveLeft event', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'), true, false)
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const item = ctx.entries.value.find((e) => 'label' in e && e.label === 'Move Left')
      if (item && 'action' in item) item.action()
      expect(wrapper.emitted('moveLeft')![0]).toEqual([7])
    })

    it('Move Right action emits moveRight event', async () => {
      const wrapper = mountHeader(makePlaylist(7, 'PL'), false, true)
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const item = ctx.entries.value.find((e) => 'label' in e && e.label === 'Move Right')
      if (item && 'action' in item) item.action()
      expect(wrapper.emitted('moveRight')![0]).toEqual([7])
    })

    it('includes a divider before Remove from Workspace', async () => {
      const wrapper = mountHeader(makePlaylist(1, 'PL'))
      await wrapper.find('.playlist-col-header__menu-btn').trigger('click')
      const entries = ctx.entries.value
      const removeIdx = entries.findIndex((e) => 'label' in e && e.label === 'Remove from Workspace')
      expect(removeIdx).toBeGreaterThan(0)
      const beforeRemove = entries[removeIdx - 1]
      expect(beforeRemove).toHaveProperty('divider', true)
    })
  })
})
