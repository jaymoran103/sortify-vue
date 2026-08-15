import { describe, it, expect } from 'vitest'
import { buildIndex } from '@/similarity/invertedIndex'
import { scanPlaylistOverlap } from '@/similarity/overlap'
import { MAX_RESULT_ROWS } from '@/similarity/constants'
import type { CursorScope, IndexInput, OverlapControls, ResultRow } from '@/similarity/types'

const PLAYLISTS: IndexInput[] = [
  { id: 1, name: 'Alpha', trackIDs: ['a', 'b', 'c', 'd'] },
  { id: 2, name: 'Beta', trackIDs: ['c', 'd'] },
  { id: 3, name: 'Gamma', trackIDs: ['d', 'e', 'f', 'g'] },
  { id: 4, name: 'Delta', trackIDs: ['x', 'y'] },
]

// Co-occurring pairs: 1:2 shares c and d, 1:3 shares d, 2:3 shares d. Delta shares nothing.
const INDEX = buildIndex(PLAYLISTS)
const EMPTY_SCOPE: CursorScope = { subject: null, ids: [] }

function controls(patch: Partial<OverlapControls> = {}): OverlapControls {
  return {
    axis: 'playlist',
    measure: 'jaccard',
    threshold: 0,
    sortKey: 'shared',
    sortDir: 'desc',
    ...patch,
  }
}

function measure(row: ResultRow, key: string): number {
  const found = row.measures.find((m) => m.key === key)
  if (!found) throw new Error(`no measure ${key}`)
  return found.value
}

describe('scanPlaylistOverlap', () => {
  it('computes jaccard and containment for a co-occurring pair', () => {
    const { rows } = scanPlaylistOverlap(INDEX, controls(), EMPTY_SCOPE)
    const alphaBeta = rows.find((r) => r.key === '1:2')
    expect(alphaBeta).toBeDefined()
    expect(measure(alphaBeta!, 'shared')).toBe(2)
    expect(measure(alphaBeta!, 'jaccard')).toBeCloseTo(0.5)
    expect(measure(alphaBeta!, 'containment')).toBeCloseTo(1)
  })

  it('never emits a pair that shares nothing', () => {
    const { rows } = scanPlaylistOverlap(INDEX, controls(), EMPTY_SCOPE)
    expect(rows.some((r) => r.key.includes('4'))).toBe(false)
  })

  it('names the smaller playlist as the contained one', () => {
    const { rows } = scanPlaylistOverlap(INDEX, controls(), EMPTY_SCOPE)
    const alphaBeta = rows.find((r) => r.key === '1:2')
    expect(alphaBeta!.secondaryLabel).toContain('Beta')
    expect(alphaBeta!.secondaryLabel).toContain('Alpha')
  })

  it('gives every row a denominator', () => {
    const { rows } = scanPlaylistOverlap(INDEX, controls(), EMPTY_SCOPE)
    for (const row of rows) expect(row.denominator).toMatch(/^\d+ of \d+$/)
  })

  it('filters on the measure the controls name', () => {
    const { rows } = scanPlaylistOverlap(
      INDEX,
      controls({ measure: 'containment', threshold: 1 }),
      EMPTY_SCOPE,
    )
    expect(rows.map((r) => r.key)).toEqual(['1:2'])
  })

  it('reports the pre-threshold pair count even when everything is filtered out', () => {
    const { rows, notes } = scanPlaylistOverlap(
      INDEX,
      controls({ measure: 'jaccard', threshold: 0.99 }),
      EMPTY_SCOPE,
    )
    expect(rows).toEqual([])
    const note = notes.find((n) => n.kind === 'pre-threshold-count')
    expect(note?.count).toBe(3)
  })

  it('runs reference-based against a single-playlist cursor', () => {
    const scope: CursorScope = { subject: 'playlist', ids: ['1'] }
    const { rows } = scanPlaylistOverlap(INDEX, controls(), scope)
    expect(rows.map((r) => r.primaryLabel).sort()).toEqual(['Beta', 'Gamma'])
    expect(rows[0]!.measures.some((m) => m.key === 'size')).toBe(true)
    expect(rows[0]!.measures.some((m) => m.key === 'sizeA')).toBe(false)
  })

  it('uses the reference playlist size as the denominator in reference mode', () => {
    const scope: CursorScope = { subject: 'playlist', ids: ['1'] }
    const { rows } = scanPlaylistOverlap(INDEX, controls(), scope)
    for (const row of rows) expect(row.denominator.endsWith(' of 4')).toBe(true)
  })

  it('keeps pairs with at least one side in a multi-playlist cursor', () => {
    const scope: CursorScope = { subject: 'playlist', ids: ['2', '3'] }
    const { rows } = scanPlaylistOverlap(INDEX, controls(), scope)
    expect(rows.map((r) => r.key).sort()).toEqual(['1:2', '1:3', '2:3'])
  })

  it('scopes to playlists containing a cursor track', () => {
    const scope: CursorScope = { subject: 'track', ids: ['e'] }
    const { rows } = scanPlaylistOverlap(INDEX, controls(), scope)
    expect(rows.map((r) => r.key).sort()).toEqual(['1:3', '2:3'])
  })

  it('sorts descending by the named measure', () => {
    const { rows } = scanPlaylistOverlap(
      INDEX,
      controls({ sortKey: 'shared', sortDir: 'desc' }),
      EMPTY_SCOPE,
    )
    const shared = rows.map((r) => measure(r, 'shared'))
    expect(shared).toEqual([...shared].sort((a, b) => b - a))
  })

  it('reports progress across the tracks it visits', () => {
    const seen: number[] = []
    scanPlaylistOverlap(INDEX, controls(), EMPTY_SCOPE, (done) => seen.push(done))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1]).toBe(INDEX.trackToPlaylists.size)
  })

  it('discloses dedupe divergence on rows whose playlists carry duplicate entries', () => {
    const withDupes = buildIndex([
      { id: 1, name: 'Dupey', trackIDs: ['a', 'a', 'b'] },
      { id: 2, name: 'Clean', trackIDs: ['a', 'b'] },
    ])
    const { rows } = scanPlaylistOverlap(withDupes, controls(), EMPTY_SCOPE)
    expect(rows[0]!.sizeTitle).toBe('Dupey: 2 unique of 3 entries')
  })
})

describe('result row cap', () => {
  it('caps emitted rows and reports the truncation', () => {
    // 200 playlists all sharing one track produces C(200,2) = 19900 pairs, well past the cap.
    const many = buildIndex(
      Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        name: `P${i + 1}`,
        trackIDs: ['shared', `own-${i}`],
      })),
    )
    const { rows, notes } = scanPlaylistOverlap(many, controls(), EMPTY_SCOPE)
    expect(rows).toHaveLength(MAX_RESULT_ROWS)
    const note = notes.find((n) => n.kind === 'truncated-rows')
    expect(note).toBeDefined()
    expect(note!.count).toBe(19900)
  })

  it('adds no truncation note when everything fits', () => {
    const { notes } = scanPlaylistOverlap(INDEX, controls(), EMPTY_SCOPE)
    expect(notes.find((n) => n.kind === 'truncated-rows')).toBeUndefined()
  })
})
