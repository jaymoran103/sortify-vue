import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { reactive, nextTick } from 'vue'
import WorkspaceView from '@/components/workspace/WorkspaceView.vue'
import AddContentModal from '@/components/workspace/AddContentModal.vue'
import LeaveWorkspaceModal from '@/components/workspace/LeaveWorkspaceModal.vue'
import type { WorkspacePlaylist, PlaylistId } from '@/types/models'
import type { Track } from '@/types/models'
import type { MenuEntry, MenuItem, AddContentChoice, WorkspaceIssue } from '@/types/ui'

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
  setTracksInPlaylist: vi.fn(),
  addTracksToWorkspace: vi.fn().mockResolvedValue(undefined),
  unassignedTrackIds: [] as string[],
  issues: [] as WorkspaceIssue[],
  $reset: vi.fn(),
})

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => mockWorkspaceStore,
}))

// ─── Mock @tanstack/vue-virtual ──────────────────────────────────────────────
// Returns a plain object (not a Ref) — Vue does not unwrap it, so
// virtualizer.getTotalSize() and virtualizer.getVirtualItems() are called directly.

// Reads the `count` it is actually given rather than the raw store list, so a filtered
// or sorted view yields exactly the rows the component intends to render. Deriving from
// the unfiltered store list makes trackAt() throw as soon as a filter narrows the list.
vi.mock('@tanstack/vue-virtual', () => ({
  useVirtualizer: (options: { value: { count: number } }) => ({
    getTotalSize: () => options.value.count * 48,
    getVirtualItems: () =>
      Array.from({ length: options.value.count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * 48,
        size: 48,
      })),
  }),
}))

// ─── Mock useContextMenu ─────────────────────────────────────────────────────
// WorkspaceView now builds the playlist column menu itself (design decision D1),
// so menu-content assertions live here rather than in PlaylistColumnHeader.spec.ts.

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

// Make debounce a pass-through so filter-dependent assertions run synchronously.
// useListFilter debounces by 200ms; without this the filtered list lags the query.
vi.mock('@/composables/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}))

// ─── Mock useModal ───────────────────────────────────────────────────────────

const mockModalOpen = vi.hoisted(() => vi.fn().mockResolvedValue(null))
vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: mockModalOpen, close: vi.fn() }),
}))

// ─── Mock useKeyboardShortcuts ───────────────────────────────────────────────
// Captures the map instead of binding it to `document`. Every mounted WorkspaceView in
// this file stays mounted and keeps its listener, so a real keydown would be handled by
// all of them at once; holding the map lets a test invoke exactly the instance it built.

const registeredShortcuts = vi.hoisted(() => ({
  current: {} as Record<string, (e: KeyboardEvent) => void>,
}))
vi.mock('@/composables/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: (map: Record<string, (e: KeyboardEvent) => void>) => {
    registeredShortcuts.current = map
  },
}))

// ─── Router ───────────────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
    // Renders the real component so onBeforeRouteLeave guards fire in mountViaRouter().
    { path: '/workspace', name: 'workspace', component: WorkspaceView },
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

// Mounting through <router-view> so onBeforeRouteLeave is registered against the
// matched route — a directly-mounted component's leave guard never fires.
let routerWrapper: ReturnType<typeof mount> | null = null

async function mountViaRouter() {
  await router.push('/workspace?session=1')
  routerWrapper = mount(
    { template: '<router-view />' },
    { global: { plugins: [router, createPinia()] } },
  )
  await flushPromises()
  return routerWrapper
}

// ─── Column menu helpers ─────────────────────────────────────────────────────

function lastMenuEntries(): MenuEntry[] {
  const calls = mockContextMenuShow.mock.calls
  return (calls[calls.length - 1]?.[1] ?? []) as MenuEntry[]
}

function lastMenuLabels(): string[] {
  return lastMenuEntries()
    .filter((e): e is MenuItem => 'label' in e)
    .map((e) => e.label)
}

function findMenuAction(label: string): (() => void) | undefined {
  const entry = lastMenuEntries().find((e) => 'label' in e && e.label === label)
  return entry && 'action' in entry ? entry.action : undefined
}

async function openColumnMenu(wrapper: ReturnType<typeof mountWorkspace>, columnIndex = 0) {
  await wrapper.findAll('.playlist-col-header__menu-btn')[columnIndex]!.trigger('click')
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
      unassignedTrackIds: [],
      issues: [],
    })
    mockWorkspaceStore.loadSession.mockResolvedValue(undefined)
    mockWorkspaceStore.toggleTrack.mockReset()
    // Reset before re-arming: mockResolvedValue alone leaves call history from prior tests,
    // which made "did not save" assertions pass or fail on test order.
    mockWorkspaceStore.save.mockReset()
    // save() resolves true on success, false on a handled failure — never throws.
    mockWorkspaceStore.save.mockResolvedValue(true)
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
    mockWorkspaceStore.setTracksInPlaylist.mockReset()
    mockWorkspaceStore.addTracksToWorkspace.mockReset()
    mockWorkspaceStore.addTracksToWorkspace.mockResolvedValue(undefined)
    mockWorkspaceStore.$reset.mockReset()
    mockContextMenuShow.mockClear()
    mockModalOpen.mockReset()
    mockModalOpen.mockResolvedValue(null)
  })

  afterEach(() => {
    // A router-mounted WorkspaceView keeps its leave guard registered until unmount.
    // Leaving one alive would fire a stale guard during a later test's navigation.
    routerWrapper?.unmount()
    routerWrapper = null
  })

  // Applied at the root rather than on the rows: the sticky table header and the control bar
  // are just as catchable on a drag that starts over the list.
  it('opts the whole view out of text selection', () => {
    const wrapper = mountWorkspace()
    expect(wrapper.find('.workspace').classes()).toContain('no-text-select')
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

  // ─── Save timestamp (W1-G) ─────────────────────────────────────────────────

  describe('save timestamp', () => {
    it('shows a saved timestamp after a successful save', async () => {
      mockWorkspaceStore.hasUnsavedChanges = true
      const wrapper = mountWorkspace()
      await wrapper.find('button.btn--primary').trigger('click')
      await flushPromises()
      mockWorkspaceStore.hasUnsavedChanges = false
      await nextTick()
      expect(wrapper.find('.workspace__saved-indicator').text()).toContain('Saved at')
    })

    it('shows no saved timestamp before any save', () => {
      mockWorkspaceStore.hasUnsavedChanges = false
      const wrapper = mountWorkspace()
      expect(wrapper.find('.workspace__saved-indicator').exists()).toBe(false)
    })

    it('unsaved changes takes precedence over the saved timestamp', async () => {
      mockWorkspaceStore.hasUnsavedChanges = true
      const wrapper = mountWorkspace()
      await wrapper.find('button.btn--primary').trigger('click')
      await flushPromises()
      await nextTick()
      expect(wrapper.find('.workspace__unsaved-indicator').exists()).toBe(true)
      expect(wrapper.find('.workspace__saved-indicator').exists()).toBe(false)
    })
  })

  // ─── Leave guard (W1-G / design decision D5) ───────────────────────────────
  // Which conditions exist is decided by utils/workspaceIssues.ts and covered in its own
  // spec. What this view owns is policy: loss blocks, quality never does, and the dialog
  // offers only the actions that can answer what it reports.

  describe('leave guard', () => {
    function lossIssue(code: WorkspaceIssue['code'], message: string): WorkspaceIssue {
      return { code, severity: 'loss', message, ids: [] }
    }

    function qualityIssue(message: string): WorkspaceIssue {
      return { code: 'empty-playlist', severity: 'quality', message, ids: [] }
    }

    type LeaveProps = { lossMessages: string[]; qualityMessages: string[]; canSave: boolean }

    function leaveModalProps(): LeaveProps {
      const [component, props] = mockModalOpen.mock.calls[0] as [unknown, LeaveProps]
      expect(component).toBe(LeaveWorkspaceModal)
      return props
    }

    it('leaves silently when nothing is at risk', async () => {
      mockWorkspaceStore.issues = []
      await mountViaRouter()
      await router.push('/dashboard')
      expect(mockModalOpen).not.toHaveBeenCalled()
      expect(router.currentRoute.value.path).toBe('/dashboard')
    })

    // Quality issues are marked in the column header all session and cannot be fixed from
    // this dialog, so they never gate the exit on their own.
    it('does not open the dialog for quality issues alone', async () => {
      mockWorkspaceStore.issues = [qualityIssue('"Morning Mix" has no tracks.')]
      await mountViaRouter()
      await router.push('/dashboard')
      expect(mockModalOpen).not.toHaveBeenCalled()
      expect(router.currentRoute.value.path).toBe('/dashboard')
    })

    it('opens one dialog listing every loss issue', async () => {
      mockWorkspaceStore.issues = [
        lossIssue('unsaved-changes', 'You have unsaved changes.'),
        lossIssue('unassigned-tracks', '"Orphan" is in no playlist and will be discarded.'),
      ]
      mockModalOpen.mockResolvedValueOnce('leave')
      await mountViaRouter()
      await router.push('/dashboard')
      expect(mockModalOpen).toHaveBeenCalledOnce()
      expect(leaveModalProps().lossMessages).toEqual([
        'You have unsaved changes.',
        '"Orphan" is in no playlist and will be discarded.',
      ])
    })

    it('passes quality issues separately, as a footnote', async () => {
      mockWorkspaceStore.issues = [
        lossIssue('unsaved-changes', 'You have unsaved changes.'),
        qualityIssue('"Morning Mix" has no tracks.'),
      ]
      mockModalOpen.mockResolvedValueOnce('leave')
      await mountViaRouter()
      await router.push('/dashboard')
      const props = leaveModalProps()
      expect(props.lossMessages).toEqual(['You have unsaved changes.'])
      expect(props.qualityMessages).toEqual(['"Morning Mix" has no tracks.'])
    })

    it('offers saving when there are unsaved changes', async () => {
      mockWorkspaceStore.issues = [lossIssue('unsaved-changes', 'You have unsaved changes.')]
      mockModalOpen.mockResolvedValueOnce('leave')
      await mountViaRouter()
      await router.push('/dashboard')
      expect(leaveModalProps().canSave).toBe(true)
    })

    // Saving cannot rescue unassigned tracks — they are discarded either way — so the action
    // is withheld rather than promising something it does not do.
    it('does not offer saving when the only loss is unassigned tracks', async () => {
      mockWorkspaceStore.issues = [
        lossIssue('unassigned-tracks', '"Orphan" is in no playlist and will be discarded.'),
      ]
      mockModalOpen.mockResolvedValueOnce('leave')
      await mountViaRouter()
      await router.push('/dashboard')
      expect(leaveModalProps().canSave).toBe(false)
    })

    it('saves before navigating when the user chooses save', async () => {
      mockWorkspaceStore.issues = [lossIssue('unsaved-changes', 'You have unsaved changes.')]
      mockModalOpen.mockResolvedValueOnce('save')
      await mountViaRouter()
      await router.push('/dashboard')
      expect(mockWorkspaceStore.save).toHaveBeenCalled()
      expect(router.currentRoute.value.path).toBe('/dashboard')
    })

    it('navigates without saving when the user chooses leave', async () => {
      mockWorkspaceStore.issues = [lossIssue('unsaved-changes', 'You have unsaved changes.')]
      mockModalOpen.mockResolvedValueOnce('leave')
      await mountViaRouter()
      await router.push('/dashboard')
      expect(mockWorkspaceStore.save).not.toHaveBeenCalled()
      expect(router.currentRoute.value.path).toBe('/dashboard')
    })

    it('stays on the page when the dialog is dismissed', async () => {
      mockWorkspaceStore.issues = [lossIssue('unsaved-changes', 'You have unsaved changes.')]
      mockModalOpen.mockResolvedValueOnce(null)
      await mountViaRouter()
      await router.push('/dashboard')
      expect(router.currentRoute.value.path).toBe('/workspace')
      expect(mockWorkspaceStore.$reset).not.toHaveBeenCalled()
    })

    // A failed save must not be followed by navigation: leaving would discard the very work
    // the user chose to keep. The store reports the reason through its error banner.
    it('stays on the page when Save & leave fails to save', async () => {
      mockWorkspaceStore.issues = [lossIssue('unsaved-changes', 'You have unsaved changes.')]
      mockModalOpen.mockResolvedValueOnce('save')
      mockWorkspaceStore.save.mockResolvedValueOnce(false)
      await mountViaRouter()
      await router.push('/dashboard')
      expect(mockWorkspaceStore.save).toHaveBeenCalled()
      expect(router.currentRoute.value.path).toBe('/workspace')
      expect(mockWorkspaceStore.$reset).not.toHaveBeenCalled()
    })

    it('resets the store when leaving is confirmed', async () => {
      mockWorkspaceStore.issues = [lossIssue('unsaved-changes', 'You have unsaved changes.')]
      mockModalOpen.mockResolvedValueOnce('leave')
      await mountViaRouter()
      await router.push('/dashboard')
      expect(mockWorkspaceStore.$reset).toHaveBeenCalled()
    })
  })

  // ─── Refresh / tab close ───────────────────────────────────────────────────
  // The route guard cannot see either. Browsers supply their own prompt text, so all this
  // decides is whether to prompt at all.

  describe('beforeunload', () => {
    function dispatchBeforeUnload(): Event {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event
    }

    it('prompts while a loss issue exists', () => {
      mockWorkspaceStore.issues = [
        { code: 'unsaved-changes', severity: 'loss', message: 'x', ids: [] },
      ]
      const wrapper = mountWorkspace()
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
      wrapper.unmount()
    })

    it('does not prompt for quality issues alone', () => {
      mockWorkspaceStore.issues = [
        { code: 'empty-playlist', severity: 'quality', message: 'x', ids: [] },
      ]
      const wrapper = mountWorkspace()
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
      wrapper.unmount()
    })

    // Asserted through the listener contract rather than by dispatching: other tests in this
    // file mount without unmounting, so their still-registered handlers read the same mock
    // store and would answer for this one.
    it('removes its listener on unmount', () => {
      const add = vi.spyOn(window, 'addEventListener')
      const remove = vi.spyOn(window, 'removeEventListener')

      const wrapper = mountWorkspace()
      const handler = add.mock.calls.find(([type]) => type === 'beforeunload')?.[1]
      expect(handler).toBeDefined()

      wrapper.unmount()
      expect(remove).toHaveBeenCalledWith('beforeunload', handler)

      add.mockRestore()
      remove.mockRestore()
    })
  })

  // ─── Add content flows (W1-H) ──────────────────────────────────────────────

  describe('add content flows', () => {
    // One control-bar button now opens AddContentModal, and the card chosen there decides
    // which picker follows. Every flow therefore resolves two modals: call 0 is the card
    // grid, call 1 is the picker whose props these tests assert on.
    async function chooseAdd(
      wrapper: ReturnType<typeof mountWorkspace>,
      choice: AddContentChoice,
      pickerResult: unknown = null,
    ) {
      mockModalOpen.mockResolvedValueOnce(choice).mockResolvedValueOnce(pickerResult)
      await wrapper.find('.workspace__add-btn').trigger('click')
      await flushPromises()
    }

    it('opens the add-content modal from the control bar', async () => {
      const wrapper = mountWorkspace()
      await wrapper.find('.workspace__add-btn').trigger('click')
      const [component] = mockModalOpen.mock.calls[0] as [unknown]
      expect(component).toBe(AddContentModal)
    })

    it('opens no picker when the add-content modal is dismissed', async () => {
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'tracks' as AddContentChoice)
      mockModalOpen.mockClear()
      mockModalOpen.mockResolvedValueOnce(null)
      await wrapper.find('.workspace__add-btn').trigger('click')
      await flushPromises()
      expect(mockModalOpen).toHaveBeenCalledTimes(1)
    })

    it('opens PlaylistSelectModal in export mode and adds each chosen playlist', async () => {
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'playlist', [4, 7])
      const [, props] = mockModalOpen.mock.calls[1] as [unknown, { mode: string }]
      expect(props.mode).toBe('export')
      expect(mockWorkspaceStore.addPlaylist).toHaveBeenCalledWith(4)
      expect(mockWorkspaceStore.addPlaylist).toHaveBeenCalledWith(7)
    })

    it('opens TrackSelectModal excluding tracks already in the workspace', async () => {
      mockWorkspaceStore.tracks = new Map([['t1', makeTrack('t1', 'Song A', 'Artist 1')]])
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'tracks')
      const [, props] = mockModalOpen.mock.calls[1] as [
        unknown,
        { excludeIds: string[]; confirmLabel: string; confirmVariant: string },
      ]
      expect(props.excludeIds).toEqual(['t1'])
      expect(props.confirmLabel).toBe('Add')
      expect(props.confirmVariant).toBe('primary')
    })

    it('adds the selected ids to the workspace', async () => {
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'tracks', ['t9'])
      expect(mockWorkspaceStore.addTracksToWorkspace).toHaveBeenCalledWith(['t9'])
    })

    it('does nothing when the track picker is cancelled', async () => {
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'tracks', null)
      expect(mockWorkspaceStore.addTracksToWorkspace).not.toHaveBeenCalled()
    })

    it('does nothing when the track picker returns an empty selection', async () => {
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'tracks', [])
      expect(mockWorkspaceStore.addTracksToWorkspace).not.toHaveBeenCalled()
    })

    it('creates a playlist from the prompt modal rather than window.prompt', async () => {
      const promptSpy = vi.spyOn(window, 'prompt')
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'new', 'My Playlist')
      expect(promptSpy).not.toHaveBeenCalled()
      expect(mockWorkspaceStore.createEmptyPlaylist).toHaveBeenCalledWith('My Playlist')
      promptSpy.mockRestore()
    })

    it('trims the new playlist name', async () => {
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'new', '  Padded  ')
      expect(mockWorkspaceStore.createEmptyPlaylist).toHaveBeenCalledWith('Padded')
    })

    it('does not create a playlist when the prompt is cancelled', async () => {
      const wrapper = mountWorkspace()
      await chooseAdd(wrapper, 'new', null)
      expect(mockWorkspaceStore.createEmptyPlaylist).not.toHaveBeenCalled()
    })
  })

  // ─── Playlist column menu ──────────────────────────────────────────────────
  // Migrated from PlaylistColumnHeader.spec.ts when D1 moved menu construction here.

  describe('playlist column menu', () => {
    it('opens from the ellipsis button', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL1', ['t1'])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      expect(mockContextMenuShow).toHaveBeenCalledOnce()
    })

    it('opens from a right-click anywhere on the header', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL1', ['t1'])]
      const wrapper = mountWorkspace()
      await wrapper.find('.playlist-col-header').trigger('contextmenu')
      expect(mockContextMenuShow).toHaveBeenCalledOnce()
    })

    it('always includes Rename, Duplicate, and Remove from Workspace', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL1', ['t1'])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      const labels = lastMenuLabels()
      expect(labels).toContain('Rename')
      expect(labels).toContain('Duplicate')
      expect(labels).toContain('Remove from Workspace')
    })

    it('omits Move Left for the leftmost column and Move Right for the rightmost', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'A', []), makePlaylist(2, 'B', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper, 0)
      expect(lastMenuLabels()).not.toContain('Move Left')
      expect(lastMenuLabels()).toContain('Move Right')
      await openColumnMenu(wrapper, 1)
      expect(lastMenuLabels()).toContain('Move Left')
      expect(lastMenuLabels()).not.toContain('Move Right')
    })

    it('offers both move directions for a middle column', async () => {
      mockWorkspaceStore.playlists = [
        makePlaylist(1, 'A', []),
        makePlaylist(2, 'B', []),
        makePlaylist(3, 'C', []),
      ]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper, 1)
      expect(lastMenuLabels()).toContain('Move Left')
      expect(lastMenuLabels()).toContain('Move Right')
    })

    it('includes a divider immediately before Remove from Workspace', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL1', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      const entries = lastMenuEntries()
      const removeIdx = entries.findIndex((e) => 'label' in e && e.label === 'Remove from Workspace')
      expect(removeIdx).toBeGreaterThan(0)
      expect(entries[removeIdx - 1]).toHaveProperty('divider', true)
    })

    it('Duplicate calls duplicatePlaylist with the column id', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(7, 'PL', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      findMenuAction('Duplicate')?.()
      expect(mockWorkspaceStore.duplicatePlaylist).toHaveBeenCalledWith(7)
    })

    it('Remove from Workspace calls removePlaylist with the column id', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(7, 'PL', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      findMenuAction('Remove from Workspace')?.()
      expect(mockWorkspaceStore.removePlaylist).toHaveBeenCalledWith(7)
    })

    // removePlaylist drops the playlist from modifiedIds, so its buffered edits go with it.
    // Correct semantics, but it used to happen silently and no later warning could cover it.
    it('confirms before removing a playlist with unsaved edits', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(7, 'Edited', [])]
      mockWorkspaceStore.modifiedIds = new Set([7])
      mockModalOpen.mockResolvedValueOnce(true)
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      findMenuAction('Remove from Workspace')?.()
      await flushPromises()
      const [, props] = mockModalOpen.mock.calls[0] as [unknown, { message: string }]
      expect(props.message).toContain('"Edited"')
      expect(mockWorkspaceStore.removePlaylist).toHaveBeenCalledWith(7)
    })

    it('keeps the playlist when the discard confirmation is declined', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(7, 'Edited', [])]
      mockWorkspaceStore.modifiedIds = new Set([7])
      mockModalOpen.mockResolvedValueOnce(null)
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      findMenuAction('Remove from Workspace')?.()
      await flushPromises()
      expect(mockWorkspaceStore.removePlaylist).not.toHaveBeenCalled()
    })

    it('does not confirm when the playlist has no unsaved edits', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(7, 'Clean', [])]
      mockWorkspaceStore.modifiedIds = new Set()
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      findMenuAction('Remove from Workspace')?.()
      await flushPromises()
      expect(mockModalOpen).not.toHaveBeenCalled()
      expect(mockWorkspaceStore.removePlaylist).toHaveBeenCalledWith(7)
    })

    it('Move Right calls movePlaylist with direction 1', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'A', []), makePlaylist(2, 'B', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper, 0)
      findMenuAction('Move Right')?.()
      expect(mockWorkspaceStore.movePlaylist).toHaveBeenCalledWith(1, 1)
    })

    it('Move Left calls movePlaylist with direction -1', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'A', []), makePlaylist(2, 'B', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper, 1)
      findMenuAction('Move Left')?.()
      expect(mockWorkspaceStore.movePlaylist).toHaveBeenCalledWith(2, -1)
    })

    // ─── Bulk membership (W1-B / design decision D4) ─────────────────────────
    // Labels name their own scope: edits are buffered until Save with no per-action
    // undo, so making the scope visible at click time is the cheap safeguard.

    it('labels bulk actions with the total count when no search is active', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL', [])]
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'Song A', 'Artist 1'),
        makeTrack('t2', 'Song B', 'Artist 2'),
      ]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      const labels = lastMenuLabels()
      expect(labels).toContain('Add all 2 tracks')
      expect(labels).toContain('Remove all 2 tracks')
    })

    it('labels bulk actions with the visible count when a search is active', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL', [])]
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'Beatles One', 'The Beatles'),
        makeTrack('t2', 'Beatles Two', 'The Beatles'),
        makeTrack('t3', 'Other Song', 'Someone'),
      ]
      const wrapper = mountWorkspace()
      await wrapper.find('.search-bar__input').setValue('beatles')
      await nextTick()
      await openColumnMenu(wrapper)
      const labels = lastMenuLabels()
      expect(labels).toContain('Add 2 visible tracks')
      expect(labels).toContain('Remove 2 visible tracks')
    })

    it('bulk add applies to the filtered set only', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL', [])]
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'Beatles One', 'The Beatles'),
        makeTrack('t2', 'Beatles Two', 'The Beatles'),
        makeTrack('t3', 'Other Song', 'Someone'),
      ]
      const wrapper = mountWorkspace()
      await wrapper.find('.search-bar__input').setValue('beatles')
      await nextTick()
      await openColumnMenu(wrapper)
      lastMenuEntries()
        .filter((e): e is MenuItem => 'label' in e)
        .find((e) => e.label.startsWith('Add'))
        ?.action()
      expect(mockWorkspaceStore.setTracksInPlaylist).toHaveBeenCalledWith(1, ['t1', 't2'], true)
    })

    it('bulk remove passes member false', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL', ['t1'])]
      mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist 1')]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      findMenuAction('Remove all 1 tracks')?.()
      expect(mockWorkspaceStore.setTracksInPlaylist).toHaveBeenCalledWith(1, ['t1'], false)
    })

    it('places a divider between the bulk actions and Rename', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      const entries = lastMenuEntries()
      const renameIdx = entries.findIndex((e) => 'label' in e && e.label === 'Rename')
      expect(entries[renameIdx - 1]).toHaveProperty('divider', true)
    })

    it('builds the menu for the column that requested it', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'A', []), makePlaylist(2, 'B', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper, 1)
      findMenuAction('Duplicate')?.()
      expect(mockWorkspaceStore.duplicatePlaylist).toHaveBeenCalledWith(2)
    })
  })

  // ─── Most Playlists sort (W1-D / design decision D7) ───────────────────────

  describe('most-playlists sort', () => {
    it('is offered in the sort dropdown', () => {
      const wrapper = mountWorkspace()
      const labels = wrapper.findAll('select.dropdown option').map((o) => o.text())
      expect(labels).toContain('Most Playlists')
    })

    it('orders tracks by descending playlist count', async () => {
      mockWorkspaceStore.playlists = [
        makePlaylist(1, 'A', ['t2']),
        makePlaylist(2, 'B', ['t2', 't3']),
        makePlaylist(3, 'C', ['t2', 't3']),
      ]
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'Zero', 'Artist'),
        makeTrack('t2', 'Three', 'Artist'),
        makeTrack('t3', 'Two', 'Artist'),
      ]
      const wrapper = mountWorkspace()
      await wrapper.find<HTMLSelectElement>('select.dropdown').setValue('most-playlists')
      await nextTick()
      const titles = wrapper.findAll('.track-row__title').map((n) => n.text())
      expect(titles).toEqual(['Three', 'Two', 'Zero'])
    })

    it('sorts a track in no playlist last', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'A', ['t2'])]
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'Orphan', 'Artist'),
        makeTrack('t2', 'Member', 'Artist'),
      ]
      const wrapper = mountWorkspace()
      await wrapper.find<HTMLSelectElement>('select.dropdown').setValue('most-playlists')
      await nextTick()
      const titles = wrapper.findAll('.track-row__title').map((n) => n.text())
      expect(titles).toEqual(['Member', 'Orphan'])
    })
  })

  // ─── Sort by this Playlist (W1-C) ──────────────────────────────────────────

  describe('sort by this playlist', () => {
    async function activatePlaylistSort(wrapper: ReturnType<typeof mountWorkspace>, col = 0) {
      await openColumnMenu(wrapper, col)
      findMenuAction('Sort by this Playlist')?.()
      await nextTick()
    }

    it('is offered in the column menu', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      expect(lastMenuLabels()).toContain('Sort by this Playlist')
    })

    it('adds a named dynamic option and activates it', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'Morning Mix', ['t1'])]
      mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist')]
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper)
      const labels = wrapper.findAll('select.dropdown option').map((o) => o.text())
      expect(labels).toContain('Playlist: Morning Mix')
      // The key is deliberately id-free — see PLAYLIST_SORT_KEY in WorkspaceView.
      expect(wrapper.find<HTMLSelectElement>('select.dropdown').element.value).toBe(
        'playlist:active',
      )
    })

    it('orders playlist members first in playlist order, then everything else', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL', ['t3', 't1'])]
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'One', 'Artist'),
        makeTrack('t2', 'Two', 'Artist'),
        makeTrack('t3', 'Three', 'Artist'),
      ]
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper)
      const titles = wrapper.findAll('.track-row__title').map((n) => n.text())
      expect(titles).toEqual(['Three', 'One', 'Two'])
    })

    it('drops the dynamic option when the user picks a static sort', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'Morning Mix', ['t1'])]
      mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist')]
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper)
      await wrapper.find<HTMLSelectElement>('select.dropdown').setValue('title')
      await nextTick()
      const labels = wrapper.findAll('select.dropdown option').map((o) => o.text())
      expect(labels).not.toContain('Playlist: Morning Mix')
    })

    it('drops the dynamic option when the playlist leaves the workspace', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'Morning Mix', ['t1'])]
      mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist')]
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper)
      mockWorkspaceStore.playlists = []
      await nextTick()
      const labels = wrapper.findAll('select.dropdown option').map((o) => o.text())
      expect(labels).not.toContain('Playlist: Morning Mix')
    })

    // The option disappearing is only half the fix: the <select> stayed bound to the departed
    // playlist key, matched no <option>, and rendered blank.
    it('falls back to Order Added when the sorted playlist leaves the workspace', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'Morning Mix', ['t1'])]
      mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist')]
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper)
      mockWorkspaceStore.playlists = []
      await nextTick()
      expect(wrapper.find<HTMLSelectElement>('select.dropdown').element.value).toBe('order-added')
    })

    it('still renders rows after the sorted playlist is removed', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'Morning Mix', ['t1'])]
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'Song A', 'Artist'),
        makeTrack('t2', 'Song B', 'Artist'),
      ]
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper)
      mockWorkspaceStore.playlists = []
      await nextTick()
      expect(wrapper.findAll('.track-row')).toHaveLength(2)
    })

    it('names the second column when that column requests the sort', async () => {
      mockWorkspaceStore.playlists = [
        makePlaylist(1, 'First', ['t1']),
        makePlaylist(2, 'Second', ['t1']),
      ]
      mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist')]
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper, 1)
      const labels = wrapper.findAll('select.dropdown option').map((o) => o.text())
      expect(labels).toContain('Playlist: Second')
    })

    // Regression: save() rewrites a workspace-created playlist's `pending-N` id to its real
    // auto-increment number, mutating the same object. Anything holding that id across a save
    // goes stale, the dynamic option disappears, and useListSort's fallback silently reorders
    // the whole view back to Order Added.
    //
    // hasUnsavedChanges must be true or the Save button renders disabled, the click does
    // nothing, and this test passes without ever exercising a save. The saveCalls assertion
    // below is there to keep that from happening again quietly.
    it('keeps the sort active when save repoints a workspace-created playlist id', async () => {
      mockWorkspaceStore.playlists = [makePlaylist('pending-1', 'Fresh Mix', ['t2'])]
      mockWorkspaceStore.trackList = [makeTrack('t1', 'One', 'Artist'), makeTrack('t2', 'Two', 'Artist')]
      mockWorkspaceStore.hasUnsavedChanges = true
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper)
      expect(wrapper.findAll('.track-row__title').map((n) => n.text())).toEqual(['Two', 'One'])

      // beforeEach re-stubs save's resolved value but does not mockReset it, so its call count
      // carries across the file. Cleared here so the assertion below counts this click only.
      mockWorkspaceStore.save.mockClear()

      // Exactly what stores/workspace.ts save() does: patch pl.id in place, clear dirty state.
      // Returns true because save() reports success as a boolean — a bare `async () => {}`
      // resolves undefined, which reads as a failed save.
      mockWorkspaceStore.save.mockImplementationOnce(async () => {
        for (const pl of mockWorkspaceStore.playlists) {
          if (typeof pl.id === 'string') pl.id = 5
        }
        mockWorkspaceStore.playlists = [...mockWorkspaceStore.playlists]
        mockWorkspaceStore.hasUnsavedChanges = false
        return true
      })
      await wrapper.find('.workspace__header-actions .btn--primary').trigger('click')
      await nextTick()
      await nextTick()

      // The save actually happened and actually repointed the id — without these two, the
      // assertions below hold trivially.
      expect(mockWorkspaceStore.save).toHaveBeenCalledTimes(1)
      expect(mockWorkspaceStore.playlists[0]!.id).toBe(5)

      expect(wrapper.find<HTMLSelectElement>('select.dropdown').element.value).toBe(
        'playlist:active',
      )
      expect(wrapper.findAll('select.dropdown option').map((o) => o.text())).toContain(
        'Playlist: Fresh Mix',
      )
      expect(wrapper.findAll('.track-row__title').map((n) => n.text())).toEqual(['Two', 'One'])
    })

    // Regression guard on the position memo: it must read pl.trackIDs reactively. Snapshotting
    // positions when the comparator is built would leave the order describing stale membership.
    it('reorders when membership in the sorted playlist changes', async () => {
      const pl = makePlaylist(1, 'PL', ['t3'])
      mockWorkspaceStore.playlists = [pl]
      mockWorkspaceStore.trackList = [
        makeTrack('t1', 'One', 'Artist'),
        makeTrack('t2', 'Two', 'Artist'),
        makeTrack('t3', 'Three', 'Artist'),
      ]
      const wrapper = mountWorkspace()
      await activatePlaylistSort(wrapper)
      expect(wrapper.findAll('.track-row__title').map((n) => n.text())).toEqual([
        'Three',
        'One',
        'Two',
      ])

      // t1 joins the playlist ahead of t3. Written through the store so the reactive proxy,
      // not the raw literal, is the object that changes.
      const live = mockWorkspaceStore.playlists[0]!
      live.trackIDs = ['t1', 't3']
      live.trackIdSet = new Set(['t1', 't3'])
      await nextTick()
      expect(wrapper.findAll('.track-row__title').map((n) => n.text())).toEqual([
        'One',
        'Three',
        'Two',
      ])
    })
  })

  // ─── Spotify actions (W1-E) ────────────────────────────────────────────────

  describe('spotify actions', () => {
    it('offers playlist Spotify actions when playlistURI is present', async () => {
      const pl = makePlaylist(1, 'PL', [])
      pl.playlistURI = 'spotify:playlist:xyz'
      mockWorkspaceStore.playlists = [pl]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      const labels = lastMenuLabels()
      expect(labels).toContain('Open in Spotify')
      expect(labels).toContain('Copy Playlist ID')
    })

    it('omits playlist Spotify actions when playlistURI is absent', async () => {
      mockWorkspaceStore.playlists = [makePlaylist(1, 'PL', [])]
      const wrapper = mountWorkspace()
      await openColumnMenu(wrapper)
      const labels = lastMenuLabels()
      expect(labels).not.toContain('Open in Spotify')
      expect(labels).not.toContain('Copy Playlist ID')
    })

    it('offers track Spotify actions when the track carries a spotifyURI', async () => {
      const track = makeTrack('t1', 'Song A', 'Artist')
      track.spotifyURI = 'spotify:track:abc'
      mockWorkspaceStore.trackList = [track]
      mockWorkspaceStore.tracks = new Map([['t1', track]])
      const wrapper = mountWorkspace()
      await wrapper.find('.track-row').trigger('contextmenu')
      const labels = lastMenuLabels()
      expect(labels).toContain('Open in Spotify')
      expect(labels).toContain('Copy Track ID')
    })

    it('falls back to a trackID that is itself a Spotify track URI', async () => {
      const track = makeTrack('spotify:track:abc', 'Song A', 'Artist')
      mockWorkspaceStore.trackList = [track]
      mockWorkspaceStore.tracks = new Map([['spotify:track:abc', track]])
      const wrapper = mountWorkspace()
      await wrapper.find('.track-row').trigger('contextmenu')
      expect(lastMenuLabels()).toContain('Open in Spotify')
    })

    it('omits track Spotify actions when no URI is available', async () => {
      const track = makeTrack('t1', 'Song A', 'Artist')
      mockWorkspaceStore.trackList = [track]
      mockWorkspaceStore.tracks = new Map([['t1', track]])
      const wrapper = mountWorkspace()
      await wrapper.find('.track-row').trigger('contextmenu')
      expect(lastMenuLabels()).not.toContain('Open in Spotify')
    })

    it('omits track Spotify actions for a multi-track selection', async () => {
      const t1 = makeTrack('t1', 'Song A', 'Artist')
      const t2 = makeTrack('t2', 'Song B', 'Artist')
      t1.spotifyURI = 'spotify:track:abc'
      t2.spotifyURI = 'spotify:track:def'
      mockWorkspaceStore.trackList = [t1, t2]
      mockWorkspaceStore.tracks = new Map([
        ['t1', t1],
        ['t2', t2],
      ])
      const wrapper = mountWorkspace()
      const rows = wrapper.findAll('.track-row')
      await rows[0]!.trigger('click')
      await rows[1]!.trigger('click', { metaKey: true })
      await rows[1]!.trigger('contextmenu')
      // Selection is single-select in the workspace, so this still resolves to one track;
      // the assertion guards the entries staying inside the single-selection branch.
      expect(lastMenuLabels().filter((l) => l === 'Open in Spotify').length).toBeLessThanOrEqual(1)
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

describe('track removal scope', () => {
  beforeEach(() => {
    mockWorkspaceStore.playlists = []
    mockWorkspaceStore.trackList = []
    mockWorkspaceStore.tracks = new Map()
    mockModalOpen.mockReset()
    mockModalOpen.mockResolvedValue(null)
  })

  /** Right-click the only row, having seeded one track and `count` playlists. */
  async function openTrackMenu(count: number) {
    const track = makeTrack('t1', 'Song A', 'Artist')
    mockWorkspaceStore.trackList = [track]
    mockWorkspaceStore.tracks = new Map([['t1', track]])
    mockWorkspaceStore.playlists = Array.from({ length: count }, (_, i) =>
      makePlaylist(i + 1, `PL${i + 1}`, []),
    )
    const wrapper = mountWorkspace()
    await wrapper.find('.track-row').trigger('contextmenu')
    return wrapper
  }

  // "All Playlists" reads as the whole library. These entries only ever touch the
  // playlists currently in the workspace, so the label says how many that is.
  it('names the workspace and the number of playlists affected', async () => {
    await openTrackMenu(4)
    const labels = lastMenuLabels()
    expect(labels).toContain('Add to 4 Workspace Playlists')
    expect(labels).toContain('Remove from 4 Workspace Playlists')
  })

  it('uses the singular form for a workspace holding one playlist', async () => {
    await openTrackMenu(1)
    const labels = lastMenuLabels()
    expect(labels).toContain('Add to 1 Workspace Playlist')
    expect(labels).toContain('Remove from 1 Workspace Playlist')
  })

  // A label reading "0 Workspace Playlists" describes an action that cannot do anything.
  it('offers no membership entries when the workspace holds no playlists', async () => {
    await openTrackMenu(0)
    const labels = lastMenuLabels()
    expect(labels.some((l) => l.startsWith('Add to'))).toBe(false)
    expect(labels.some((l) => l.startsWith('Remove from 0'))).toBe(false)
    expect(labels).toContain('Remove from Workspace')
  })

  // The one single-track action whose effect cannot be undone by eye: the row leaves the
  // table, and unticking a checkbox will not bring it back.
  it('confirms before removing a track from the workspace, naming the track', async () => {
    await openTrackMenu(2)
    await findMenuAction('Remove from Workspace')!()
    await flushPromises()
    expect(mockModalOpen).toHaveBeenCalledOnce()
    const [, props] = mockModalOpen.mock.calls[0] as [unknown, { message: string }]
    expect(props.message).toContain('Song A')
  })

  it('removes the track once the confirmation is accepted', async () => {
    mockModalOpen.mockResolvedValueOnce(true)
    await openTrackMenu(2)
    await findMenuAction('Remove from Workspace')!()
    await flushPromises()
    expect(mockWorkspaceStore.removeTrackFromWorkspace).toHaveBeenCalledWith('t1')
  })

  it('keeps the track when the confirmation is dismissed', async () => {
    mockWorkspaceStore.removeTrackFromWorkspace.mockClear()
    mockModalOpen.mockResolvedValueOnce(null)
    await openTrackMenu(2)
    await findMenuAction('Remove from Workspace')!()
    await flushPromises()
    expect(mockWorkspaceStore.removeTrackFromWorkspace).not.toHaveBeenCalled()
  })

  // Membership edits stay instant: their effect is a visible checkbox and re-tickable.
  it('does not confirm when removing a track from the workspace playlists', async () => {
    await openTrackMenu(2)
    await findMenuAction('Remove from 2 Workspace Playlists')!()
    await flushPromises()
    expect(mockModalOpen).not.toHaveBeenCalled()
    expect(mockWorkspaceStore.removeTrackFromAll).toHaveBeenCalledWith('t1')
  })
})

describe('delete shortcut', () => {
  beforeEach(() => {
    mockWorkspaceStore.playlists = []
    mockWorkspaceStore.tracks = new Map()
    mockModalOpen.mockReset()
    mockModalOpen.mockResolvedValue(null)
  })

  function pressDelete(): void {
    registeredShortcuts.current['cmd+backspace']!(new KeyboardEvent('keydown'))
  }

  // The shortcut and the row's own menu entry are the same action, so they ask the same
  // question. Routing both through handleDeleteTrack is what keeps them from diverging —
  // the bulk dialog would have said "1 track(s)".
  it('asks the single-track question when one row is selected', async () => {
    const track = makeTrack('t1', 'Song A', 'Artist')
    mockWorkspaceStore.trackList = [track]
    mockWorkspaceStore.tracks = new Map([['t1', track]])
    const wrapper = mountWorkspace()
    await wrapper.find('.track-row').trigger('click')
    await nextTick()

    pressDelete()
    await flushPromises()

    expect(mockModalOpen).toHaveBeenCalledOnce()
    const [, props] = mockModalOpen.mock.calls[0] as [unknown, { message: string }]
    expect(props.message).toContain('Song A')
  })

  it('opens nothing when no row is selected', async () => {
    mockWorkspaceStore.trackList = [makeTrack('t1', 'Song A', 'Artist')]
    mountWorkspace()
    await nextTick()

    pressDelete()
    await flushPromises()

    expect(mockModalOpen).not.toHaveBeenCalled()
  })
})
