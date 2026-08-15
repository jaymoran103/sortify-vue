import type {
  CursorScope,
  IndexInput,
  IndexStats,
  OverlapControls,
  ScanRequest,
  ScanResponse,
  ScanResult,
} from './types'

type ProgressCallback = (done: number, total: number) => void

/**
 * Omit does not distribute over a union, so Omit<ScanRequest, 'id'> would collapse to the common
 * keys and lose each variant's payload. This distributes it member by member.
 */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never
type ScanRequestInit = DistributiveOmit<ScanRequest, 'id'>

/** A request awaiting its response. */
interface PendingRequest {
  resolve: (value: never) => void
  reject: (error: Error) => void
  onProgress?: ProgressCallback
  isScan: boolean
}

/** Creates the real worker. Vite resolves this URL form into a bundled worker chunk. */
function defaultFactory(): Worker {
  return new Worker(new URL('./similarity.worker.ts', import.meta.url), { type: 'module' })
}

/**
 * Promise wrapper around the similarity worker.
 *
 * Takes an optional worker factory so tests inject a fake and never load a real worker. The
 * worker itself is created lazily, on the first request, so importing this module costs nothing.
 */
export class SimilarityWorkerClient {
  private worker: Worker | null = null
  private readonly factory: () => Worker
  private readonly pending = new Map<number, PendingRequest>()
  private nextId = 1
  private latestScanId = 0

  constructor(factory: () => Worker = defaultFactory) {
    this.factory = factory
  }

  /** Creates the worker on first use and attaches the single message listener. */
  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = this.factory()
    worker.addEventListener('message', (event: MessageEvent<ScanResponse>) => {
      this.handle(event.data)
    })
    this.worker = worker
    return worker
  }

  /**
   * Routes one worker response to its pending request.
   *
   * A scan whose id is no longer the latest resolves null rather than its rows. That is what
   * makes dragging the threshold slider safe: only the most recent scan is ever applied.
   */
  private handle(response: ScanResponse): void {
    const entry = this.pending.get(response.id)
    if (!entry) return

    if (response.type === 'progress') {
      entry.onProgress?.(response.done, response.total)
      return
    }

    this.pending.delete(response.id)

    if (response.type === 'error') {
      entry.reject(new Error(response.message))
      return
    }

    if (response.type === 'built') {
      ;(entry.resolve as (value: IndexStats) => void)(response.stats)
      return
    }

    const stale = entry.isScan && response.id !== this.latestScanId
    ;(entry.resolve as (value: ScanResult | null) => void)(stale ? null : response.result)
  }

  /** Assigns an id, records the pending entry, and posts the request. */
  private send<T>(
    request: ScanRequestInit,
    isScan: boolean,
    onProgress?: ProgressCallback,
  ): Promise<T> {
    const worker = this.ensureWorker()
    const id = this.nextId
    this.nextId += 1
    if (isScan) this.latestScanId = id

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: never) => void,
        reject,
        onProgress,
        isScan,
      })
      worker.postMessage({ ...request, id } as ScanRequest)
    })
  }

  /** Builds the inverted index inside the worker and resolves its summary stats. */
  async build(playlists: IndexInput[]): Promise<IndexStats> {
    return this.send<IndexStats>({ type: 'build', playlists }, false)
  }

  /** Runs a scan. Resolves null when a newer scan has superseded this one. */
  async scan(
    controls: OverlapControls,
    scope: CursorScope,
    onProgress?: ProgressCallback,
  ): Promise<ScanResult | null> {
    return this.send<ScanResult | null>({ type: 'scan', controls, scope }, true, onProgress)
  }

  /** Tears down the worker and drops every pending request. */
  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
  }
}

/** Factory used by the store, so tests can mock this module rather than the class. */
export function createWorkerClient(): SimilarityWorkerClient {
  return new SimilarityWorkerClient()
}
