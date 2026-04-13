import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '@/components/workspace/WorkspaceView.vue'
import type { WorkspacePlaylist, PlaylistId } from '@/types/models'
import type { Track } from '@/types/models'

// ─── Mock workspace store ────────────────────────────────────────────────────

const mockWorkspaceStore = {
  isLoading: false,
  error: null as string | null,
  playlists: [] as WorkspacePlaylist[],
  trackList: [] as Track[],
  sessionId: null as number | null,
  sessionName: '',
  modifiedIds: new Set<PlaylistId>(),
  tracks: new Map<string, Track>(),
  loadSession: vi.fn().mockResolvedValue(undefined),
  $reset: vi.fn(),
}

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
    { path: '/workspace', component: { template: '<div />' } },
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

function makeTrack(trackID: string, title: string, artist: string): Track {
  return { trackID, title, artist, album: 'Album', source: 'csv' }
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
      tracks: new Map(),
    })
    mockWorkspaceStore.loadSession.mockResolvedValue(undefined)
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
    const headers = wrapper.findAll('.workspace__th--playlist')
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
    expect(wrapper.findAll('.workspace__row')).toHaveLength(2)
    expect(wrapper.text()).toContain('Song A')
    expect(wrapper.text()).toContain('Song B')
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
})
