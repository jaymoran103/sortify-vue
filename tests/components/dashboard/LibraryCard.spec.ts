import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { vi } from 'vitest'
import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryCard from '@/components/dashboard/LibraryCard.vue'
import type { Playlist } from '@/types/models'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

let mockTracks: unknown[] = []
let mockPlaylists: Playlist[] = []

vi.mock('@/stores/tracks', () => ({
  useTrackStore: () => ({ tracks: mockTracks, clearTracks: vi.fn() }),
}))

const mockUpdatePlaylist = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({
    playlists: mockPlaylists,
    deletePlaylists: vi.fn(),
    clearPlaylists: vi.fn(),
    updatePlaylist: mockUpdatePlaylist,
  }),
}))

// Make debounce a pass-through so filter tests run synchronously
vi.mock('@/composables/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}))

const mockContextMenuShow = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useContextMenu', () => ({
  useContextMenu: () => ({
    show: mockContextMenuShow,
    close: vi.fn(),
    isOpen: { value: false },
    position: { value: { x: 0, y: 0 } },
    entries: { value: [] },
  }),
}))

const mockModalOpen = vi.hoisted(() => vi.fn().mockResolvedValue(null))
vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: mockModalOpen, close: vi.fn() }),
}))

const ScrollableListStub = {
  props: ['items'],
  template: `
    <div>
      <template v-for="(item, index) in items" :key="index">
        <slot name="item" :item="item" :index="index" />
      </template>
      <template v-if="items.length === 0">
        <slot name="empty" />
      </template>
    </div>
  `,
}

const ControlBarStub = {
  template: '<div><slot /><slot name="actions" /></div>',
}

const SearchBarStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: '<input class="search-bar__input" type="search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

function mountCard() {
  const pinia = createPinia()
  return mount(LibraryCard, {
    global: {
      plugins: [router, pinia],
      stubs: {
        ScrollableList: ScrollableListStub,
        ControlBar: ControlBarStub,
        SearchBar: SearchBarStub,
        SelectDropdown: { props: ['modelValue', 'options'], template: '<select />' },
      },
    },
  })
}

describe('LibraryCard', () => {
  beforeEach(() => {
    mockTracks = []
    mockPlaylists = []
    mockContextMenuShow.mockClear()
    mockModalOpen.mockClear()
    mockModalOpen.mockResolvedValue(null)
    mockUpdatePlaylist.mockClear()
  })

  it('displays track count from store', () => {
    mockPlaylists = [{ id: 1, name: 'A', trackIDs: ['a', 'b', 'c'] }]
    const wrapper = mountCard()
    expect(wrapper.text().toLowerCase()).toContain('3total tracks')
  })

  it('displays unique track count from store', () => {
    mockPlaylists = [
      { id: 1, name: 'A', trackIDs: ['a', 'b', 'c'] },
      { id: 2, name: 'B', trackIDs: ['b', 'c', 'd'] },
    ]
    const wrapper = mountCard()
    expect(wrapper.text().toLowerCase()).toContain('4unique tracks')
  })

  it('displays playlist count from store', () => {
    mockPlaylists = [
      { id: 1, name: 'Blues', trackIDs: [] },
      { id: 2, name: 'Rock', trackIDs: [] },
    ]
    const wrapper = mountCard()
    expect(wrapper.text().toLowerCase()).toContain('2playlists')
  })

  it('renders each playlist name', () => {
    mockPlaylists = [
      { id: 1, name: 'Blues Mix', trackIDs: ['x', 'y'] },
      { id: 2, name: 'Rock Mix', trackIDs: [] },
    ]
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Blues Mix')
    expect(wrapper.text()).toContain('Rock Mix')
  })

  it('renders trackIDs count per playlist row', () => {
    mockPlaylists = [{ id: 1, name: 'My List', trackIDs: ['a', 'b', 'c'] }]
    const wrapper = mountCard()
    // "3 tracks" appears in the playlist row meta
    const meta = wrapper.find('.library-card__meta')
    expect(meta.text()).toContain('3 tracks')
  })

  it('shows empty message when no playlists', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('No playlists yet')
  })

  // ── View toggle ────────────────────────────────────────────────────────────
  it('defaults to playlists view with Playlists button active', () => {
    const wrapper = mountCard()
    const playlistsBtn = wrapper.find('[toggle-mode="tracks-playlists"]')
    const tracksBtn = wrapper.find('[toggle-mode="tracks-view"]')
    expect(playlistsBtn.classes()).toContain('library-card__toggle-btn--active')
    expect(tracksBtn.classes()).not.toContain('library-card__toggle-btn--active')
  })

  it('switches to tracks view when Tracks button is clicked', async () => {
    mockTracks = [{ trackID: 'x', title: 'Song A', artist: 'Artist X' }]
    const wrapper = mountCard()
    await wrapper.find('[toggle-mode="tracks-view"]').trigger('click')
    expect(wrapper.text()).toContain('Song A')
    expect(wrapper.text()).toContain('Artist X')
  })

  it('Tracks button gets active class and Playlists loses it after switching', async () => {
    const wrapper = mountCard()
    const playlistsBtn = wrapper.find('[toggle-mode="tracks-playlists"]')
    const tracksBtn = wrapper.find('[toggle-mode="tracks-view"]')
    await tracksBtn.trigger('click')
    expect(tracksBtn.classes()).toContain('library-card__toggle-btn--active')
    expect(playlistsBtn.classes()).not.toContain('library-card__toggle-btn--active')
  })

  // ── Tracks view content ────────────────────────────────────────────────────
  it('renders track title and artist rows in tracks view', async () => {
    mockTracks = [
      { trackID: 'a', title: 'Midnight Rain', artist: 'Taylor Swift' },
      { trackID: 'b', title: 'Hotel California', artist: 'Eagles' },
    ]
    const wrapper = mountCard()
    await wrapper.find('[toggle-mode="tracks-view"]').trigger('click')
    expect(wrapper.text()).toContain('Midnight Rain')
    expect(wrapper.text()).toContain('Taylor Swift')
    expect(wrapper.text()).toContain('Hotel California')
  })

  it('shows empty message when no tracks in tracks view', async () => {
    const wrapper = mountCard()
    await wrapper.find('[toggle-mode="tracks-view"]').trigger('click')
    expect(wrapper.text()).toContain('No tracks yet')
  })

  // ── Search / filter ────────────────────────────────────────────────────────
  it('filters playlists by query', async () => {
    mockPlaylists = [
      { id: 1, name: 'Blues Mix', trackIDs: [] },
      { id: 2, name: 'Rock Classics', trackIDs: [] },
    ]
    const wrapper = mountCard()
    await wrapper.find('.search-bar__input').setValue('blues')
    expect(wrapper.text()).toContain('Blues Mix')
    expect(wrapper.text()).not.toContain('Rock Classics')
  })

  it('shows no-match empty state when playlist query has no results', async () => {
    mockPlaylists = [{ id: 1, name: 'Blues Mix', trackIDs: [] }]
    const wrapper = mountCard()
    await wrapper.find('.search-bar__input').setValue('zzz')
    expect(wrapper.text()).toContain('No playlists match search')
  })

  it('filters tracks by title and artist in tracks view', async () => {
    mockTracks = [
      { trackID: 'a', title: 'Midnight Blues', artist: 'B.B. King' },
      { trackID: 'b', title: 'Rock Anthem', artist: 'Led Zeppelin' },
    ]
    const wrapper = mountCard()
    await wrapper.find('[toggle-mode="tracks-view"]').trigger('click')
    await wrapper.find('.search-bar__input').setValue('midnight')
    expect(wrapper.text()).toContain('Midnight Blues')
    expect(wrapper.text()).not.toContain('Rock Anthem')
  })

  it('shows no-match empty state when track query has no results', async () => {
    mockTracks = [{ trackID: 'a', title: 'Some Song', artist: 'Artist' }]
    const wrapper = mountCard()
    await wrapper.find('[toggle-mode="tracks-view"]').trigger('click')
    await wrapper.find('.search-bar__input').setValue('zzz')
    expect(wrapper.text()).toContain('No tracks match search')
  })

  // ── Management button ──────────────────────────────────────────────────────
  it('management button calls contextMenu.show', async () => {
    const wrapper = mountCard()
    await wrapper.find('[toggle-mode="management-menu"]').trigger('click')
    expect(mockContextMenuShow).toHaveBeenCalledOnce()
  })

  // ── Rename ─────────────────────────────────────────────────────────────────
  it('renders a rename button for each playlist row', () => {
    mockPlaylists = [
      { id: 1, name: 'Blues Mix', trackIDs: [] },
      { id: 2, name: 'Rock Mix', trackIDs: [] },
    ]
    const wrapper = mountCard()
    expect(wrapper.findAll('.library-card__rename-btn')).toHaveLength(2)
  })

  it('clicking rename opens modal with the correct playlist', async () => {
    mockPlaylists = [{ id: 3, name: 'Jazz Night', trackIDs: [] }]
    const wrapper = mountCard()
    await wrapper.find('.library-card__rename-btn').trigger('click')
    expect(mockModalOpen).toHaveBeenCalledOnce()
    const [, props] = mockModalOpen.mock.calls[0] as [unknown, { playlist: Playlist }]
    expect(props.playlist.name).toBe('Jazz Night')
  })

  it('calls updatePlaylist when modal returns a new name', async () => {
    mockPlaylists = [{ id: 3, name: 'Jazz Night', trackIDs: [] }]
    mockModalOpen.mockResolvedValueOnce('Renamed Jazz')
    const wrapper = mountCard()
    await wrapper.find('.library-card__rename-btn').trigger('click')
    await flushPromises()
    expect(mockUpdatePlaylist).toHaveBeenCalledWith(3, { name: 'Renamed Jazz' })
  })
})
