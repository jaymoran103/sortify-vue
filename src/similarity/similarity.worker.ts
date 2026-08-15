import { buildIndex } from './invertedIndex'
import { scanPlaylistOverlap, scanTrackOverlap } from './overlap'
import type { InvertedIndex, ScanRequest, ScanResponse } from './types'

/**
 * Similarity scan worker.
 *
 * Holds no logic of its own: it decodes a request, calls a pure function from the module, and
 * posts the result back. Keeping it this thin is what lets every algorithm be unit-tested without
 * instantiating a worker.
 *
 * Typed against the DOM `Worker` interface rather than the `webworker` lib, which would conflict
 * with the `dom` lib that tsconfig.app.json already uses. `Worker` carries both
 * addEventListener('message') and postMessage, so this typechecks with no tsconfig change.
 */
const ctx = self as unknown as Worker

/**
 * The index is retained between scans, so changing a preset or nudging a threshold costs a scan
 * rather than a rebuild. It is cleared only when the main thread sends a fresh build request.
 */
let index: InvertedIndex | null = null

function post(response: ScanResponse): void {
  ctx.postMessage(response)
}

ctx.addEventListener('message', (event: MessageEvent<ScanRequest>) => {
  const request = event.data

  try {
    if (request.type === 'build') {
      index = buildIndex(request.playlists)
      post({
        id: request.id,
        type: 'built',
        stats: {
          playlistCount: index.playlistSets.size,
          uniqueTrackCount: index.trackToPlaylists.size,
          builtAt: index.builtAt,
        },
      })
      return
    }

    if (!index) {
      post({ id: request.id, type: 'error', message: 'Index has not been built yet.' })
      return
    }

    const onProgress = (done: number, total: number): void => {
      post({ id: request.id, type: 'progress', done, total, phase: request.controls.axis })
    }

    const result =
      request.controls.axis === 'track'
        ? scanTrackOverlap(index, request.controls, request.scope, onProgress)
        : scanPlaylistOverlap(index, request.controls, request.scope, onProgress)

    post({ id: request.id, type: 'result', result })
  } catch (error) {
    post({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : 'Scan failed.',
    })
  }
})
