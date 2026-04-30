import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { reactive, nextTick } from 'vue'
import WorkspaceView from '@/components/workspace/WorkspaceView.vue'
import type { WorkspacePlaylist, PlaylistId } from '@/types/models'
import type { Track } from '@/types/models'

// ─── Mock workspace store ────────────────────────────────────────────────────

const mockWorkspaceStore = reactive({
  isLoading: false,
  error: null as string | null,
  playlists: [] as WorkspacePlaylist[],
  trackList: [] as Track[],
  sessionId: null as number | null,
  sessionName: '',
  modifiedIds: new Set<PlaylistId>(),
  hasUnsavedChanges: false,
  tracks: new Map<string, Track>(),
  loadSession: vi.fn().mockResolvedValue(undefined),
  toggleTrack: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  renamePlaylist: vi.fn(),
  removePlaylist: vi.fn(),
  duplicatePlaylist: vi.fn(),
  movePlaylist: vi.fn(),
  addPlaylist: vi.fn().mockResolvedValue(undefined),
  createEmptyPlaylist: vi.fn(),
  addTrackToAll: vi.fn(),
  removeTrackFromAll: vi.fn(),
  removeTrackFromWorkspace: vi.fn(),
  bulkAddToAll: vi.fn(),
  bulkRemoveFromAll: vi.fn(),
  bulkRemoveFromWorkspace: vi.fn(),
  $reset: vi.fn(),
})

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => mockWorkspaceStore,
}))

// ─── Mock @tanstack/vue-virtual ──────────────────────────────────────────────
// Returns a plain object (not a Ref) — Vue does not unwrap it, so
// virtualizer.getTotalSize() and virtualizer.getVirtualItems() are called directly.

vi.mock('@tanstack/vue-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => mockWorkspaceStore.trackList.length * 48,
    getVirtualItems: () =>
      mockWorkspaceStore.trackList.map(
        (_, i) => ({ index: i, key: String(i), start: i * 48, size: 48 }) as const,
      ),
  }),
}))

// ─── Router ───────────────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
    { path: '/workspace', name: 'workspace', component: { template: '<div />' } },
  ],
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlaylist(id: PlaylistId, name: string, trackIDs: string[]): WorkspacePlaylist {
  return {
    id,
    name,
    trackIDs,
    trackIdSet: new Set(trackIDs),
    origin: 'library',
  }
}

function makeTrack(trackID: string, title: string, artist: string, album = 'Album'): Track {
  return { trackID, title, artist, album, source: 'csv' }
}

function mountWorkspace() {
  return mount(WorkspaceView, {
    global: { plugins: [router, createPinia()] },
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkspaceView', () => {
  beforeEach(async () => {
    await router.push('/workspace?session=1')
    Object.assign(mockWorkspaceStore, {
      isLoading: false,
      error: null,
      playlists: [],
      trackList: [],
      sessionId: null,
      sessionName: '',
      modifiedIds: new Set<PlaylistId>(),
      hasUnsavedChanges: false,
      tracks: new Map(),
    })
    mockWorkspaceStore.loadSession.mockResolvedValue(undefined)
    mockWorkspaceStore.toggleTrack.mockReset()
    mockWorkspaceStore.save.mockResolvedValue(undefined)
    mockWorkspaceStore.renamePlaylist.mockReset()
    mockWorkspaceStore.removePlaylist.mockReset()
    mockWorkspaceStore.duplicatePlaylist.mockReset()
    mockWorkspaceStore.movePlaylist.mockReset()
    mockWorkspaceStore.addPlaylist.mockResolvedValue(undefined)
    mockWorkspaceStore.createEmptyPlaylist.mockReset()
    mockWorkspaceStore.addTrackToAll.mockReset()
    mockWorkspaceStore.removeTrackFromAll.mockReset()
    mockWorkspaceStore.removeTrackFromWorkspace.mockReset()
    mockWorkspaceStore.bulkAddToAll.mockReset()
    mockWorkspaceStore.bulkRemoveFromAll.mockReset()
    mockWorkspaceStore.bulkRemoveFromWorkspace.mockReset()
    mockWorkspaceStore.$reset.mockReset()
  })

  it('renders loading state when store is loading', () => {
    mockWorkspaceStore.isLoading = true
    const wrapper = mountWorkspace()
    expect(wrapper.text()).toContain('Loading session')
    expect(wrapper.find('.workspace__body').exists()).toBe(false)
  })

  it('does not show the track table while loading', () => {
    mockWorkspaceStore.isLoading = true
    const wrapper = mountWorkspace()
    expect(wrapper.find('.workspace__table-header').exists()).toBe(false)
  })

  it('renders error state when error is set', () => {
    mockWorkspaceStore.error = 'Session not found.'
    const wrapper = mountWorkspace()
    expect(wrapper.text()).toContain('Session not found.')
    expect(wrapper.find('.workspace__loading').exists()).toBe(false)
    expect(wrapper.find('.workspace__body').exists()).toBe(false)
  })

  it('error state shows a Back to Dashboard button', () => {
    mockWorkspaceStore.error = 'Session not found.'
    const wrapper = mountWorkspace()
    expect(wrapper.find('.workspace__error button').exists()).toBe(true)
  })

  it('clicking Back to Dashboard navigates to the dashboard route', async () => {
    const wrapper = mountWorkspace()
    const pushSpy = vi.spyOn(router, 'push')
    const btn = wrapper.find('button.btn--secondary')
    await btn.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'dashboard' })
    pushSpy.mockRestore()
  })

  it('renders the track table when data is loaded', () => {
    mockWorkspaceStore.playlists = [makePlaylist(1, 'Playlist A', ['t1', 't2'])]
    mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist 1')]
    const wrapper = mountWorkspace()
    expect(wrapper.find('.workspace__body').exists()).toBe(true)
    expect(wrapper.find('.workspace__table-header').exists()).toBe(true)
    expect(wrapper.text()).toContain('Song A')
  })

  it('renders one column header per playlist', () => {
    mockWorkspaceStore.playlists = [
      makePlaylist(1, 'Morning Mix', ['t1']),
      makePlaylist(2, 'Evening Chill', ['t2']),
    ]
    mockWorkspaceStore.trackList = []
    const wrapper = mountWorkspace()
    const headers = wrapper.findAll('.playlist-col-header__name')
    expect(headers).toHaveLength(2)
    expect(headers[0]?.text()).toBe('Morning Mix')
    expect(headers[1]?.text()).toBe('Evening Chill')
  })

  it('renders a row for each track in trackList', () => {
    mockWorkspaceStore.playlists = [makePlaylist(1, 'PL1', ['t1', 't2'])]
    mockWorkspaceStore.trackList = [
      makeTrack('t1', 'Song A', 'Artist 1'),
      makeTrack('t2', 'Song B', 'Artist 2'),
    ]
    const wrapper = mountWorkspace()
    expect(wrapper.findAll('.track-row')).toHaveLength(2)
    expect(wrapper.text()).toContain('Song A')
    expect(wrapper.text()).toContain('Song B')
  })

  it('renders tracks in the DOM in the same order as workspaceStore.trackList', () => {
    mockWorkspaceStore.playlists = [
      makePlaylist(1, 'PL1', ['t1', 't2']),
      makePlaylist(2, 'PL2', ['t3']),
    ]
    mockWorkspaceStore.trackList = [
      makeTrack('t2', 'Song B', 'Artist 2'),
      makeTrack('t1', 'Song A', 'Artist 1'),
      makeTrack('t3', 'Song C', 'Artist 3'),
    ]

    const wrapper = mountWorkspace()
    const titles = wrapper.findAll('.track-row__title').map((node) => node.text())
    expect(titles).toEqual(['Song B', 'Song A', 'Song C'])
  })

  it('updates the rendered row order when trackList order changes after toggleTrack', async () => {
    mockWorkspaceStore.playlists = [
      makePlaylist(1, 'PL1', ['t1', 't2']),
      makePlaylist(2, 'PL2', ['t3', 't2']),
    ]
    mockWorkspaceStore.tracks = new Map([
      ['t1', makeTrack('t1', 'Song A', 'Artist 1')],
      ['t2', makeTrack('t2', 'Song B', 'Artist 2')],
      ['t3', makeTrack('t3', 'Song C', 'Artist 3')],
    ])
    mockWorkspaceStore.trackList = [
      makeTrack('t1', 'Song A', 'Artist 1'),
      makeTrack('t2', 'Song B', 'Artist 2'),
      makeTrack('t3', 'Song C', 'Artist 3'),
    ]

    mockWorkspaceStore.toggleTrack = vi.fn((playlistId: PlaylistId, trackId: string) => {
      const playlist = mockWorkspaceStore.playlists.find((p) => p.id === playlistId)
      if (!playlist) return

      if (playlist.trackIdSet.has(trackId)) {
        playlist.trackIDs = playlist.trackIDs.filter((id) => id !== trackId)
        playlist.trackIdSet.delete(trackId)
      } else {
        playlist.trackIDs.push(trackId)
        playlist.trackIdSet.add(trackId)
      }

      const seen = new Set<string>()
      const nextTrackList: Track[] = []
      for (const pl of mockWorkspaceStore.playlists) {
        for (const id of pl.trackIDs) {
          if (!seen.has(id)) {
            seen.add(id)
            const track = mockWorkspaceStore.tracks.get(id)
            if (track) nextTrackList.push(track)
          }
        }
      }
      mockWorkspaceStore.trackList = nextTrackList
    })

    const wrapper = mountWorkspace()
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[2]!.trigger('change')
    await nextTick()

    const titles = wrapper.findAll('.track-row__title').map((node) => node.text())
    expect(titles).toEqual(['Song A', 'Song C', 'Song B'])
  })

  it('uses trackIdSet.has() for checkbox checked state', () => {
    const pl = makePlaylist(1, 'PL1', ['t1', 't2'])
    // Override trackIdSet so only t1 is "checked"
    pl.trackIdSet = new Set(['t1'])

    mockWorkspaceStore.playlists = [pl]
    mockWorkspaceStore.trackList = [
      makeTrack('t1', 'Song A', 'Artist 1'),
      makeTrack('t2', 'Song B', 'Artist 2'),
    ]

    const wrapper = mountWorkspace()
    const checkboxes = wrapper.findAll('input[type="checkbox"]')

    const checkbox0 = checkboxes[0]
    const checkbox1 = checkboxes[1]
    expect(checkbox0).toBeDefined()
    expect(checkbox1).toBeDefined()

    // Row 0, PL1 → t1 in trackIdSet → checked
    expect((checkbox0!.element as HTMLInputElement).checked).toBe(true)
    // Row 1, PL1 → t2 NOT in trackIdSet → unchecked
    expect((checkbox1!.element as HTMLInputElement).checked).toBe(false)
  })

  it('checkboxes are interactive (not disabled)', () => {
    mockWorkspaceStore.playlists = [makePlaylist(1, 'PL1', ['t1'])]
    mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist 1')]
    const wrapper = mountWorkspace()
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).disabled).toBe(false)
  })

  it('displays session name in header', () => {
    mockWorkspaceStore.sessionName = 'My Session'
    const wrapper = mountWorkspace()
    expect(wrapper.find('.workspace__title').text()).toContain('My Session')
  })

  it('displays playlist and track counts in header', () => {
    mockWorkspaceStore.playlists = [makePlaylist(1, 'PL1', ['t1'])]
    mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist 1')]
    const wrapper = mountWorkspace()
    expect(wrapper.find('.workspace__meta').text()).toContain('1 playlists')
    expect(wrapper.find('.workspace__meta').text()).toContain('1 tracks')
  })

  it('calls loadSession with session id from route query', async () => {
    await router.push('/workspace?session=42')
    mountWorkspace()
    await new Promise((r) => setTimeout(r, 0)) // flush microtasks
    expect(mockWorkspaceStore.loadSession).toHaveBeenCalledWith(42)
  })

  it('calls $reset when unmounted', () => {
    const wrapper = mountWorkspace()
    wrapper.unmount()
    expect(mockWorkspaceStore.$reset).toHaveBeenCalled()
  })

  it('clicking a checkbox calls workspaceStore.toggleTrack with the correct ids', async () => {
    const pl = makePlaylist(1, 'PL1', ['t1'])
    mockWorkspaceStore.playlists = [pl]
    mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist 1')]
    const wrapper = mountWorkspace()

    await wrapper.find('input[type="checkbox"]').trigger('change')

    expect(mockWorkspaceStore.toggleTrack).toHaveBeenCalledWith(1, 't1')
  })

  it('save button is disabled when hasUnsavedChanges is false', () => {
    mockWorkspaceStore.hasUnsavedChanges = false
    const wrapper = mountWorkspace()
    const btn = wrapper.find('button.btn--primary')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('save button is enabled when hasUnsavedChanges is true', () => {
    mockWorkspaceStore.hasUnsavedChanges = true
    const wrapper = mountWorkspace()
    const btn = wrapper.find('button.btn--primary')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('unsaved changes indicator is visible when hasUnsavedChanges is true', () => {
    mockWorkspaceStore.hasUnsavedChanges = true
    const wrapper = mountWorkspace()
    expect(wrapper.find('.workspace__unsaved-indicator').exists()).toBe(true)
    expect(wrapper.find('.workspace__unsaved-indicator').text()).toContain('Unsaved changes')
  })

  it('unsaved changes indicator is hidden when hasUnsavedChanges is false', () => {
    mockWorkspaceStore.hasUnsavedChanges = false
    const wrapper = mountWorkspace()
    expect(wrapper.find('.workspace__unsaved-indicator').exists()).toBe(false)
  })

  it('clicking save button calls workspaceStore.save', async () => {
    mockWorkspaceStore.hasUnsavedChanges = true
    const wrapper = mountWorkspace()
    await wrapper.find('button.btn--primary').trigger('click')
    expect(mockWorkspaceStore.save).toHaveBeenCalled()
  })

  describe('track row display', () => {
    it('renders track title, artist, and album in separate elements', () => {
      mockWorkspaceStore.trackList = [makeTrack('t1', 'My Song', 'My Artist', 'My Album')]
      const wrapper = mountWorkspace()
      expect(wrapper.find('.track-row__title').text()).toBe('My Song')
      expect(wrapper.find('.track-row__artist').text()).toBe('My Artist')
      expect(wrapper.find('.track-row__album').text()).toBe('My Album')
    })

    it('artist and album are not concatenated', () => {
      mockWorkspaceStore.trackList = [makeTrack('t1', 'Song', 'ArtistName', 'AlbumName')]
      const wrapper = mountWorkspace()
      const artistEl = wrapper.find('.track-row__artist')
      const albumEl = wrapper.find('.track-row__album')
      expect(artistEl.text()).not.toContain('AlbumName')
      expect(albumEl.text()).not.toContain('ArtistName')
    })
  })

  describe('sort options', () => {
    it('sort dropdown includes album option', () => {
      const wrapper = mountWorkspace()
      const options = wrapper.findAll('select.dropdown option')
      const labels = options.map((o) => o.text())
      expect(labels).toContain('Album')
    })

    it('sort dropdown includes title, artist, and order-added options', () => {
      const wrapper = mountWorkspace()
      const options = wrapper.findAll('select.dropdown option')
      const labels = options.map((o) => o.text())
      expect(labels).toContain('Title')
      expect(labels).toContain('Artist')
      expect(labels).toContain('Order Added')
    })

    it('selecting album sort orders rows by album name', async () => {
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'Song 1', 'Artist', 'Zebra'),
        makeTrack('t2', 'Song 2', 'Artist', 'Apple'),
        makeTrack('t3', 'Song 3', 'Artist', 'Mango'),
      ]
      const wrapper = mountWorkspace()
      const select = wrapper.find<HTMLSelectElement>('select.dropdown')
      await select.setValue('album')
      await nextTick()
      const titles = wrapper.findAll('.track-row__title').map((n) => n.text())
      expect(titles).toEqual(['Song 2', 'Song 3', 'Song 1'])
    })

    it('selecting title sort orders rows by title', async () => {
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'Zebra Song', 'Artist', 'Album'),
        makeTrack('t2', 'Apple Song', 'Artist', 'Album'),
      ]
      const wrapper = mountWorkspace()
      const select = wrapper.find<HTMLSelectElement>('select.dropdown')
      await select.setValue('title')
      await nextTick()
      const titles = wrapper.findAll('.track-row__title').map((n) => n.text())
      expect(titles).toEqual(['Apple Song', 'Zebra Song'])
    })
  })
})
