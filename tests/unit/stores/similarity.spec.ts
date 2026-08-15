import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import type { Playlist } from '@/types/models'
import type { IndexStats, ScanResult } from '@/similarity/types'

const buildMock = vi.fn<(playlists: unknown, canonical?: unknown) => Promise<IndexStats>>()
const scanMock = vi.fn<(...args: unknown[]) => Promise<ScanResult | null>>()
const scanDoublesMock = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const terminateMock = vi.fn()

vi.mock('@/similarity/workerClient', () => ({
  createWorkerClient: () => ({
    build: buildMock,
    scan: scanMock,
    scanDoubles: scanDoublesMock,
    terminate: terminateMock,
  }),
}))

const saveDetectedMock = vi.fn().mockResolvedValue(undefined)
const equivalenceState = reactive({
  all: [] as unknown[],
  knownGroups: [] as unknown[],
  canonicalMap: new Map<string, string>(),
  unconfirmedCount: 0,
  saveDetected: saveDetectedMock,
  listAll: vi.fn().mockResolvedValue([]),
})

/** Drives the fresh-read path the store uses instead of liveQuery. */
function setStoredGroups(groups: unknown[]): void {
  equivalenceState.all = groups
  equivalenceState.listAll = vi.fn().mockResolvedValue(groups)
}
vi.mock('@/stores/equivalence', () => ({
  useEquivalenceStore: () => equivalenceState,
  // The store imports this free function too; a mock missing it makes ensureIndex throw silently.
  canonicalMapFrom: (groups: { status: string; trackIds: string[]; preferredTrackId?: string }[]) => {
    const map = new Map<string, string>()
    for (const group of groups) {
      if (group.status !== 'confirmed') continue
      const canonical = group.preferredTrackId ?? group.trackIds[0]
      if (canonical) for (const id of group.trackIds) map.set(id, canonical)
    }
    return map
  },
}))

// A real Pinia store unwraps its refs on property access, so the mock must too. A plain object of
// refs would make store.playlists a Ref rather than an array, and every read would break.
// reactive() gives the same unwrapping while staying writable from the test.
const playlistState = reactive({ playlists: [] as Playlist[] })
const trackState = reactive({
  tracks: [{ trackID: 'a', title: 'Anytime', artist: 'Journey', album: '', source: 'csv' }],
})

vi.mock('@/stores/playlists', () => ({ usePlaylistStore: () => playlistState }))
vi.mock('@/stores/tracks', () => ({ useTrackStore: () => trackState }))

const { useSimilarityStore } = await import('@/stores/similarity')

function seedPlaylists(): void {
  playlistState.playlists = [
    { id: 1, name: 'One', trackIDs: ['a', 'b'], lastModified: 100 },
    { id: 2, name: 'Two', trackIDs: ['b', 'c'], lastModified: 200 },
  ]
}

describe('useSimilarityStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    buildMock.mockReset()
    scanMock.mockReset()
    buildMock.mockResolvedValue({ playlistCount: 2, uniqueTrackCount: 3, builtAt: 1 })
    scanMock.mockResolvedValue({ rows: [], notes: [] })
    scanDoublesMock.mockReset()
    scanDoublesMock.mockResolvedValue({ groups: [], result: { rows: [], notes: [] } })
    saveDetectedMock.mockClear()
    equivalenceState.all = []
    equivalenceState.knownGroups = []
    setStoredGroups([])
    seedPlaylists()
  })

  it('starts idle with the default preset applied to its controls', () => {
    const store = useSimilarityStore()
    expect(store.indexStatus).toBe('idle')
    expect(store.activePresetKey).toBe('overlap-any')
    expect(store.controls.axis).toBe('playlist')
  })

  it('builds the index once and reports ready', async () => {
    const store = useSimilarityStore()
    await store.ensureIndex()
    await store.ensureIndex()
    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(store.indexStatus).toBe('ready')
    expect(store.indexStats?.uniqueTrackCount).toBe(3)
  })

  it('sends only ids, names and track ids into the worker', async () => {
    const store = useSimilarityStore()
    await store.ensureIndex()
    expect(buildMock.mock.calls[0]![0]).toEqual([
      { id: 1, name: 'One', trackIDs: ['a', 'b'] },
      { id: 2, name: 'Two', trackIDs: ['b', 'c'] },
    ])
  })

  it('goes stale when the library revision changes', async () => {
    const store = useSimilarityStore()
    await store.ensureIndex()
    expect(store.indexStatus).toBe('ready')
    playlistState.playlists = [
      ...playlistState.playlists,
      { id: 3, name: 'Three', trackIDs: ['d'], lastModified: 300 },
    ]
    await nextTick()
    expect(store.indexStatus).toBe('stale')
  })

  it('rebuilds a stale index when a scan is requested', async () => {
    const store = useSimilarityStore()
    await store.ensureIndex()
    playlistState.playlists = [
      ...playlistState.playlists,
      { id: 3, name: 'Three', trackIDs: ['d'], lastModified: 300 },
    ]
    await nextTick()
    await store.run()
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(store.indexStatus).toBe('ready')
  })

  it('keeps the previous rows when a scan is superseded', async () => {
    const store = useSimilarityStore()
    scanMock.mockResolvedValueOnce({
      rows: [
        {
          key: '1:2',
          subject: 'playlist',
          primaryLabel: 'One',
          measures: [],
          denominator: '1 of 3',
          memberIds: ['1', '2'],
        },
      ],
      notes: [],
    })
    await store.run()
    expect(store.rows).toHaveLength(1)
    scanMock.mockResolvedValueOnce(null)
    await store.run()
    expect(store.rows).toHaveLength(1)
  })

  it('applies a preset by replacing the controls wholesale', async () => {
    const store = useSimilarityStore()
    await store.applyPreset('overlap-contained')
    expect(store.activePresetKey).toBe('overlap-contained')
    expect(store.controls.measure).toBe('containment')
    expect(store.controls.threshold).toBe(1)
  })

  it('merges a control patch without changing the preset key', async () => {
    const store = useSimilarityStore()
    await store.setControls({ threshold: 0.5 })
    expect(store.controls.threshold).toBe(0.5)
    expect(store.activePresetKey).toBe('overlap-any')
  })

  // Regression: the playlist store hydrates asynchronously and seeds its ref with [], so a cold
  // load could build a zero-track index, mark it ready, and report that nothing overlaps forever.
  it('stays idle rather than building an index from an unhydrated library', async () => {
    playlistState.playlists = []
    const store = useSimilarityStore()
    await store.ensureIndex()
    expect(buildMock).not.toHaveBeenCalled()
    expect(store.indexStatus).toBe('idle')
  })

  it('builds once the library hydrates', async () => {
    playlistState.playlists = []
    const store = useSimilarityStore()
    await store.run()
    expect(store.indexStatus).toBe('idle')

    seedPlaylists()
    await nextTick()
    await store.run()
    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(store.indexStatus).toBe('ready')
  })

  it('records an error message when a scan rejects', async () => {
    const store = useSimilarityStore()
    scanMock.mockRejectedValueOnce(new Error('boom'))
    await store.run()
    expect(store.error).toBe('boom')
    expect(store.isScanning).toBe(false)
  })
})

describe('useSimilarityStore doubles mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    buildMock.mockReset()
    scanMock.mockReset()
    scanDoublesMock.mockReset()
    saveDetectedMock.mockClear()
    buildMock.mockResolvedValue({ playlistCount: 2, uniqueTrackCount: 3, builtAt: 1 })
    scanMock.mockResolvedValue({ rows: [], notes: [] })
    scanDoublesMock.mockResolvedValue({ groups: [], result: { rows: [], notes: [] } })
    equivalenceState.all = []
    equivalenceState.knownGroups = []
    setStoredGroups([])
    seedPlaylists()
  })

  it('switches mode with the active preset', async () => {
    const store = useSimilarityStore()
    expect(store.mode).toBe('overlap')
    await store.applyPreset('doubles-unreviewed')
    expect(store.mode).toBe('doubles')
    expect(store.doublesControls.reviewFilter).toBe('unconfirmed')
  })

  it('routes run() to the doubles scan while in doubles mode', async () => {
    const store = useSimilarityStore()
    await store.applyPreset('doubles-unreviewed')
    expect(scanDoublesMock).toHaveBeenCalled()
    expect(scanMock).not.toHaveBeenCalled()
  })

  it('persists newly detected groups before rendering them', async () => {
    const store = useSimilarityStore()
    scanDoublesMock.mockResolvedValueOnce({
      groups: [{ trackIds: ['a', 'b'], matchTier: 'high' }],
      result: { rows: [], notes: [] },
    })
    await store.applyPreset('doubles-unreviewed')
    expect(saveDetectedMock).toHaveBeenCalledWith([{ trackIds: ['a', 'b'], matchTier: 'high' }])
  })

  it('does not write when nothing new was detected', async () => {
    const store = useSimilarityStore()
    await store.applyPreset('doubles-unreviewed')
    expect(saveDetectedMock).not.toHaveBeenCalled()
  })

  it('keeps previous rows when a doubles scan is superseded', async () => {
    const store = useSimilarityStore()
    scanDoublesMock.mockResolvedValueOnce({
      groups: [],
      result: {
        rows: [
          {
            key: 'g1',
            subject: 'track',
            primaryLabel: 'Respect',
            measures: [],
            denominator: '2 variants across 1 playlists',
            memberIds: ['a', 'b'],
          },
        ],
        notes: [],
      },
    })
    await store.applyPreset('doubles-unreviewed')
    expect(store.rows).toHaveLength(1)
    scanDoublesMock.mockResolvedValueOnce(null)
    await store.run()
    expect(store.rows).toHaveLength(1)
  })
})

describe('useSimilarityStore equivalence toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    buildMock.mockReset()
    scanMock.mockReset()
    buildMock.mockResolvedValue({ playlistCount: 2, uniqueTrackCount: 3, builtAt: 1 })
    scanMock.mockResolvedValue({ rows: [], notes: [] })
    setStoredGroups([
      { id: 1, trackIds: ['a', 'b'], status: 'confirmed', matchTier: 'high', detectedAt: 1 },
    ])
    seedPlaylists()
  })

  it('is on by default and passes the canonical map into the build', async () => {
    const store = useSimilarityStore()
    expect(store.equivalenceEnabled).toBe(true)
    await store.ensureIndex()
    expect(buildMock.mock.calls[0]![1]).toBeInstanceOf(Map)
  })

  it('rebuilds the index when the toggle changes, since the fold is baked in', async () => {
    const store = useSimilarityStore()
    await store.run()
    expect(buildMock).toHaveBeenCalledTimes(1)
    await store.setEquivalenceEnabled(false)
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(buildMock.mock.calls[1]![1]).toBeUndefined()
  })

  it('does nothing when set to its current value', async () => {
    const store = useSimilarityStore()
    await store.run()
    await store.setEquivalenceEnabled(true)
    expect(buildMock).toHaveBeenCalledTimes(1)
  })
})

describe('useSimilarityStore rail', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    buildMock.mockReset()
    scanMock.mockReset()
    buildMock.mockResolvedValue({ playlistCount: 2, uniqueTrackCount: 3, builtAt: 1 })
    setStoredGroups([])
    seedPlaylists()
  })

  it('lists only findings that returned something', async () => {
    scanMock.mockResolvedValue({ rows: [], notes: [] })
    const store = useSimilarityStore()
    await store.refreshRail()
    expect(store.railFindings).toEqual([])
  })

  it('ranks containment above near-identical, whatever the counts', async () => {
    scanMock.mockImplementation(async (controls: unknown) => {
      const measure = (controls as { measure: string }).measure
      return measure === 'containment'
        ? { rows: [{}, {}], notes: [] }
        : { rows: [{}, {}, {}, {}, {}], notes: [] }
    })
    const store = useSimilarityStore()
    await store.refreshRail()
    expect(store.railFindings.map((f) => f.presetKey)).toEqual([
      'overlap-contained',
      'overlap-near-identical',
    ])
    expect(store.railFindings[0]!.count).toBe(2)
  })

  it('includes unreviewed doubles between the two overlap findings', async () => {
    scanMock.mockResolvedValue({ rows: [{}], notes: [] })
    setStoredGroups([
      { id: 1, trackIds: ['a', 'b'], status: 'unconfirmed', matchTier: 'high', detectedAt: 1 },
    ])
    const store = useSimilarityStore()
    await store.refreshRail()
    expect(store.railFindings.map((f) => f.presetKey)).toEqual([
      'overlap-contained',
      'doubles-unreviewed',
      'overlap-near-identical',
    ])
  })

  it('empties itself when the index is not ready', async () => {
    playlistState.playlists = []
    const store = useSimilarityStore()
    await store.refreshRail()
    expect(store.railFindings).toEqual([])
  })
})
