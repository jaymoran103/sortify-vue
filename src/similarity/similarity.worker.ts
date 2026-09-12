import { buildIndex } from './invertedIndex'
import { buildContainmentClusters } from './containment'
import { buildDoublesRows, detectGroups, type ScannableGroup } from './doubles'
import { scanPlaylistOverlap, scanTrackOverlap } from './overlap'
import type { InvertedIndex, ScanNote, ScanRequest, ScanResponse } from './types'

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
      // The canonical map arrives as entry pairs because a Map survives structured clone but
      // pairs keep the payload shape obvious and cheap to assert on.
      const canonical = request.canonical ? new Map(request.canonical) : undefined
      index = buildIndex(request.playlists, canonical)
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

    if (request.type === 'containment') {
      post({ id: request.id, type: 'clusters', clusters: buildContainmentClusters(index) })
      return
    }

    if (request.type === 'doubles') {
      const notes: ScanNote[] = []
      const groups = detectGroups(request.tracks, request.known, notes)

      // Newly detected groups have no id yet; stored ones do. Both are rendered together so the
      // user sees one list rather than a split between "new" and "known".
      const scannable: ScannableGroup[] = [
        ...request.stored,
        ...groups.map((group) => ({
          trackIds: group.trackIds,
          matchTier: group.matchTier,
          status: 'unconfirmed' as const,
        })),
      ]

      const lookup = new Map(request.tracks.map((track) => [track.trackID, track]))
      const result = buildDoublesRows(
        scannable,
        lookup,
        index,
        request.controls,
        request.scope,
        notes,
      )
      post({ id: request.id, type: 'detected', groups, result })
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
