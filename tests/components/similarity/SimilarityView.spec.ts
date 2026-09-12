import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import type { ResultRow } from '@/similarity/types'
import type { Playlist } from '@/types/models'

const runMock = vi.fn()
const applyPresetMock = vi.fn()
const setControlsMock = vi.fn()
const loadContainmentMock = vi.fn()

const SEED_ROW: ResultRow = {
  key: '1:2',
  subject: 'playlist',
  primaryLabel: 'Alpha <-> Beta',
  measures: [{ key: 'shared', label: 'Shared', value: 2, display: '2' }],
  denominator: '2 of 4',
  memberIds: ['1', '2'],
}

// reactive(), not refs: a real Pinia store unwraps on property access and the component reads
// store.rows, store.controls and so on directly.
const storeState = reactive({
  indexStatus: 'ready' as 'idle' | 'building' | 'ready' | 'stale' | 'error',
  indexStats: { playlistCount: 2, uniqueTrackCount: 3, builtAt: 1 },
  rows: [SEED_ROW] as ResultRow[],
  notes: [{ kind: 'pre-threshold-count' as const, message: '3 pairs', count: 3 }],
  controls: {
    axis: 'playlist' as const,
    measure: 'jaccard' as const,
    threshold: 0.1,
    sortKey: 'shared',
    sortDir: 'desc' as const,
  },
  activePresetKey: 'overlap-any',
  mode: 'overlap' as 'overlap' | 'doubles',
  doublesControls: {
    reviewFilter: 'unconfirmed' as const,
    minTier: 'low' as const,
    sortKey: 'variants',
    sortDir: 'desc' as const,
  },
  equivalenceEnabled: true,
  railFindings: [] as { presetKey: string; label: string; count: number }[],
  containmentClusters: [] as unknown[],
  selectedClusterKey: '',
  isScanning: false,
  scanProgress: null,
  error: null as string | null,
  run: runMock,
  applyPreset: applyPresetMock,
  setControls: setControlsMock,
  setDoublesControls: vi.fn(),
  setEquivalenceEnabled: vi.fn(),
  refreshRail: vi.fn(),
  loadContainment: loadContainmentMock,
  selectCluster: vi.fn(),
  ensureIndex: vi.fn(),
  dispose: vi.fn(),
})

const equivalenceState = reactive({
  all: [] as unknown[],
  confirmedGroups: [] as unknown[],
  setPreferred: vi.fn(),
  confirm: vi.fn(),
  reject: vi.fn(),
  confirmAll: vi.fn(),
})
vi.mock('@/stores/equivalence', () => ({ useEquivalenceStore: () => equivalenceState }))

const trackState = reactive({ tracks: [] as unknown[] })
vi.mock('@/stores/tracks', () => ({ useTrackStore: () => trackState }))

vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: vi.fn().mockResolvedValue(null), close: vi.fn() }),
}))

const playlistState = reactive({
  playlists: [
    { id: 1, name: 'Alpha', trackIDs: ['a', 'b'] },
    { id: 2, name: 'Beta', trackIDs: ['b', 'c'] },
  ] as Playlist[],
  addPlaylist: vi.fn().mockResolvedValue(9),
  batchUpdatePlaylists: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@/stores/similarity', () => ({ useSimilarityStore: () => storeState }))
vi.mock('@/stores/playlists', () => ({ usePlaylistStore: () => playlistState }))

const pushMock = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

const createSessionMock = vi.fn().mockResolvedValue(7)
vi.mock('@/stores/sessions', () => ({
  useSessionStore: () => ({ createSession: createSessionMock }),
}))

const ScrollableListStub = {
  props: ['items'],
  template: `
    <div>
      <template v-for="(item, index) in items" :key="index">
        <slot name="item" :item="item" :index="index" />
      </template>
      <slot v-if="items.length === 0" name="empty" />
    </div>
  `,
}

const SimilarityView = (await import('@/components/similarity/SimilarityView.vue')).default

function factory() {
  return mount(SimilarityView, { global: { stubs: { ScrollableList: ScrollableListStub } } })
}

describe('SimilarityView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    runMock.mockClear()
    pushMock.mockClear()
    createSessionMock.mockClear()
    storeState.rows = [SEED_ROW]
  })

  it('runs the default scan on mount', () => {
    factory()
    expect(runMock).toHaveBeenCalled()
  })

  it('renders the palette, the control bar, the table and the verb strip', () => {
    const wrapper = factory()
    expect(wrapper.findComponent({ name: 'OperationPalette' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ResultControlBar' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ResultTable' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ResultVerbStrip' }).exists()).toBe(true)
  })

  it('applies a preset when the palette emits select', async () => {
    const wrapper = factory()
    await wrapper
      .findComponent({ name: 'OperationPalette' })
      .vm.$emit('select', 'overlap-contained')
    expect(applyPresetMock).toHaveBeenCalledWith('overlap-contained')
  })

  it('forwards a control patch to the store', async () => {
    const wrapper = factory()
    await wrapper.findComponent({ name: 'ResultControlBar' }).vm.$emit('update', { threshold: 0.7 })
    expect(setControlsMock).toHaveBeenCalledWith({ threshold: 0.7 })
  })

  it('renders every scan note so no exclusion is silent', () => {
    const wrapper = factory()
    expect(wrapper.find('.similarity-view__notes').text()).toContain('3 pairs')
  })

  it('creates a session and navigates on openInWorkspace', async () => {
    const wrapper = factory()
    await wrapper
      .findComponent({ name: 'ResultTable' })
      .vm.$emit('rowClick', '1:2', new MouseEvent('click'))
    await wrapper.findComponent({ name: 'ResultVerbStrip' }).vm.$emit('openInWorkspace')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(createSessionMock).toHaveBeenCalledWith([1, 2])
    expect(pushMock).toHaveBeenCalledWith({ path: '/workspace', query: { session: '7' } })
  })

  it('tells the user the threshold is the problem when everything is filtered out', () => {
    storeState.rows = []
    const wrapper = factory()
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text().toLowerCase()).toContain('threshold')
  })
})

describe('SimilarityView header', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    pushMock.mockClear()
    storeState.rows = [SEED_ROW]
  })

  it('renders a page header matching the workspace pattern', () => {
    const wrapper = factory()
    const header = wrapper.find('.similarity-view__header')
    expect(header.exists()).toBe(true)
    expect(header.find('.similarity-view__title').text()).toBe('Similarity')
  })

  it('offers Back to Dashboard, as the workspace header does', async () => {
    const wrapper = factory()
    const back = wrapper
      .findAll('.similarity-view__header button')
      .find((b) => b.text().includes('Back to Dashboard'))
    expect(back).toBeDefined()
    await back!.trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ name: 'dashboard' })
  })

  it('reports library scale in the meta line', () => {
    // The mocked playlist store holds two playlists sharing track b: 2 playlists, 3 unique tracks.
    expect(factory().find('.similarity-view__meta').text()).toBe('2 playlists · 3 tracks')
  })

  it('singularises a one-playlist library', () => {
    playlistState.playlists = [{ id: 1, name: 'Only', trackIDs: ['a'] }]
    expect(factory().find('.similarity-view__meta').text()).toBe('1 playlist · 1 track')
    playlistState.playlists = [
      { id: 1, name: 'Alpha', trackIDs: ['a', 'b'] },
      { id: 2, name: 'Beta', trackIDs: ['b', 'c'] },
    ]
  })

  it('keeps the cursor bar below the header rather than replacing it', () => {
    const wrapper = factory()
    expect(wrapper.find('.similarity-view__header').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'CursorBar' }).exists()).toBe(true)
  })
})

describe('SimilarityView containment map', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    loadContainmentMock.mockClear()
    storeState.activePresetKey = 'overlap-any'
    storeState.containmentClusters = []
  })

  it('offers no map for a preset that does not read containment', () => {
    const bar = factory().findComponent({ name: 'ResultControlBar' })
    expect(bar.props('canShowMap')).toBe(false)
  })

  it('offers the map for the containment preset', () => {
    storeState.activePresetKey = 'overlap-contained'
    const bar = factory().findComponent({ name: 'ResultControlBar' })
    expect(bar.props('canShowMap')).toBe(true)
  })

  it('loads the containment forest only when the map is opened', async () => {
    storeState.activePresetKey = 'overlap-contained'
    const wrapper = factory()
    expect(loadContainmentMock).not.toHaveBeenCalled()

    await wrapper.findComponent({ name: 'ResultControlBar' }).vm.$emit('updateView', 'map')
    expect(loadContainmentMock).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent({ name: 'ContainmentMap' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ResultTable' }).exists()).toBe(false)
  })

  it('falls back to the table when the preset stops reading containment', async () => {
    storeState.activePresetKey = 'overlap-contained'
    const wrapper = factory()
    await wrapper.findComponent({ name: 'ResultControlBar' }).vm.$emit('updateView', 'map')
    expect(wrapper.findComponent({ name: 'ContainmentMap' }).exists()).toBe(true)

    storeState.activePresetKey = 'overlap-any'
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'ContainmentMap' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ResultTable' }).exists()).toBe(true)
  })
})
