import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import type { Playlist } from '@/types/models'
import type { IndexStats, ScanResult } from '@/similarity/types'

const buildMock = vi.fn<(playlists: unknown) => Promise<IndexStats>>()
const scanMock = vi.fn<(...args: unknown[]) => Promise<ScanResult | null>>()
const terminateMock = vi.fn()

vi.mock('@/similarity/workerClient', () => ({
  createWorkerClient: () => ({
    build: buildMock,
    scan: scanMock,
    terminate: terminateMock,
  }),
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
