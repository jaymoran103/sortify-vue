import { describe, it, expect, vi } from 'vitest'
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

  it('terminates the underlying worker', () => {
    const { client, worker } = makeClient()
    void client.scan(CONTROLS, SCOPE)
    client.terminate()
    expect(worker.terminated).toBe(true)
  })
})
