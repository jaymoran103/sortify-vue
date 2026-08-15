import { describe, it, expect, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { SimilarityWorkerClient } from '@/similarity/workerClient'
import type { CursorScope, OverlapControls, ScanRequest, ScanResponse } from '@/similarity/types'

const SCOPE: CursorScope = { subject: null, ids: [] }
const CONTROLS: OverlapControls = {
  axis: 'playlist',
  measure: 'jaccard',
  threshold: 0,
  sortKey: 'shared',
  sortDir: 'desc',
}

/** Stands in for a real Worker so no worker is ever instantiated in tests. */
class FakeWorker {
  public sent: ScanRequest[] = []
  public terminated = false
  private listeners: ((event: MessageEvent<ScanResponse>) => void)[] = []

  addEventListener(_type: string, listener: (event: MessageEvent<ScanResponse>) => void): void {
    this.listeners.push(listener)
  }

  postMessage(request: ScanRequest): void {
    this.sent.push(request)
  }

  terminate(): void {
    this.terminated = true
  }

  /** Drives a response back into the client, as the real worker would. */
  emit(response: ScanResponse): void {
    for (const listener of this.listeners) {
      listener({ data: response } as MessageEvent<ScanResponse>)
    }
  }
}

function makeClient(): { client: SimilarityWorkerClient; worker: FakeWorker } {
  const worker = new FakeWorker()
  const client = new SimilarityWorkerClient(() => worker as unknown as Worker)
  return { client, worker }
}

describe('SimilarityWorkerClient', () => {
  it('resolves build with the stats the worker reports', async () => {
    const { client, worker } = makeClient()
    const promise = client.build([{ id: 1, name: 'One', trackIDs: ['a'] }])
    const id = worker.sent[0]!.id
    worker.emit({ id, type: 'built', stats: { playlistCount: 1, uniqueTrackCount: 1, builtAt: 5 } })
    await expect(promise).resolves.toEqual({ playlistCount: 1, uniqueTrackCount: 1, builtAt: 5 })
  })

  it('forwards progress messages to the callback', async () => {
    const { client, worker } = makeClient()
    const onProgress = vi.fn()
    const promise = client.scan(CONTROLS, SCOPE, onProgress)
    const id = worker.sent[0]!.id
    worker.emit({ id, type: 'progress', done: 3, total: 10, phase: 'playlist' })
    worker.emit({ id, type: 'result', result: { rows: [], notes: [] } })
    await promise
    expect(onProgress).toHaveBeenCalledWith(3, 10)
  })

  it('resolves null for a scan superseded by a newer one', async () => {
    const { client, worker } = makeClient()
    const first = client.scan(CONTROLS, SCOPE)
    const second = client.scan(CONTROLS, SCOPE)
    const firstId = worker.sent[0]!.id
    const secondId = worker.sent[1]!.id
    worker.emit({ id: secondId, type: 'result', result: { rows: [], notes: [] } })
    worker.emit({ id: firstId, type: 'result', result: { rows: [], notes: [] } })
    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toEqual({ rows: [], notes: [] })
  })

  it('rejects when the worker reports an error', async () => {
    const { client, worker } = makeClient()
    const promise = client.scan(CONTROLS, SCOPE)
    worker.emit({ id: worker.sent[0]!.id, type: 'error', message: 'boom' })
    await expect(promise).rejects.toThrow('boom')
  })

  // Regression: Vue reactive state cannot be structured-cloned, so passing a ref's value or a
  // computed's value straight through made postMessage throw "could not be cloned" and the scan
  // silently never ran. Only a real worker enforces this, so assert it explicitly here.
  it('posts plain values that survive structuredClone', async () => {
    const { client, worker } = makeClient()
    const reactiveControls = ref<OverlapControls>({ ...CONTROLS })
    const reactiveScope = reactive<CursorScope>({ subject: 'playlist', ids: ['1', '2'] })

    void client.scan(reactiveControls.value, reactiveScope)

    const sent = worker.sent[0]!
    expect(() => structuredClone(sent)).not.toThrow()
    expect(sent).toEqual({
      id: 1,
      type: 'scan',
      controls: CONTROLS,
      scope: { subject: 'playlist', ids: ['1', '2'] },
    })
  })

  it('posts a build payload that survives structuredClone', () => {
    const { client, worker } = makeClient()
    const reactivePlaylists = reactive([{ id: 1, name: 'One', trackIDs: ['a', 'b'] }])
    void client.build(reactivePlaylists)
    expect(() => structuredClone(worker.sent[0]!)).not.toThrow()
  })

  it('terminates the underlying worker', () => {
    const { client, worker } = makeClient()
    void client.scan(CONTROLS, SCOPE)
    client.terminate()
    expect(worker.terminated).toBe(true)
  })
})

describe('SimilarityWorkerClient doubles', () => {
  it('resolves a doubles scan with detected groups and rows', async () => {
    const { client, worker } = makeClient()
    const promise = client.scanDoubles(
      [{ trackID: 'a', title: 'Respect', artist: 'Aretha Franklin' }],
      [],
      [],
      { reviewFilter: 'all', minTier: 'low', sortKey: 'variants', sortDir: 'desc' },
      SCOPE,
    )
    const id = worker.sent[0]!.id
    worker.emit({
      id,
      type: 'detected',
      groups: [{ trackIds: ['a', 'b'], matchTier: 'high' }],
      result: { rows: [], notes: [] },
    })
    const resolved = await promise
    expect(resolved?.groups).toHaveLength(1)
  })

  it('posts a doubles payload that survives structuredClone', () => {
    const { client, worker } = makeClient()
    const reactiveTracks = reactive([
      { trackID: 'a', title: 'Respect', artist: 'Aretha Franklin', duration: '145000' },
    ])
    const reactiveScope = reactive<CursorScope>({ subject: 'track', ids: ['a'] })
    void client.scanDoubles(
      reactiveTracks,
      reactive([{ trackIds: ['a'], status: 'confirmed' as const }]),
      reactive([
        { id: 1, trackIds: ['a'], matchTier: 'high' as const, status: 'confirmed' as const },
      ]),
      reactive({
        reviewFilter: 'all' as const,
        minTier: 'low' as const,
        sortKey: 'variants',
        sortDir: 'desc' as const,
      }),
      reactiveScope,
    )
    expect(() => structuredClone(worker.sent[0]!)).not.toThrow()
  })

  it('posts a canonical map as plain entry pairs', () => {
    const { client, worker } = makeClient()
    void client.build([{ id: 1, name: 'One', trackIDs: ['a'] }], new Map([['b', 'a']]))
    const sent = worker.sent[0]!
    expect(() => structuredClone(sent)).not.toThrow()
    expect(sent).toMatchObject({ type: 'build', canonical: [['b', 'a']] })
  })

  it('resolves null for a doubles scan superseded by a newer one', async () => {
    const { client, worker } = makeClient()
    const controls = {
      reviewFilter: 'all' as const,
      minTier: 'low' as const,
      sortKey: 'variants',
      sortDir: 'desc' as const,
    }
    const first = client.scanDoubles([], [], [], controls, SCOPE)
    const second = client.scanDoubles([], [], [], controls, SCOPE)
    worker.emit({
      id: worker.sent[1]!.id,
      type: 'detected',
      groups: [],
      result: { rows: [], notes: [] },
    })
    worker.emit({
      id: worker.sent[0]!.id,
      type: 'detected',
      groups: [],
      result: { rows: [], notes: [] },
    })
    await expect(first).resolves.toBeNull()
    await expect(second).resolves.not.toBeNull()
  })
})
