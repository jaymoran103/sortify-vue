import { describe, it, expect } from 'vitest'
import { buildIndex } from '@/similarity/invertedIndex'
import { scanTrackOverlap, hydrateTrackLabels } from '@/similarity/overlap'
import { TRACK_AXIS_MAX_SIZE } from '@/similarity/constants'
import type { CursorScope, IndexInput, OverlapControls, ResultRow } from '@/similarity/types'

const PLAYLISTS: IndexInput[] = [
  { id: 1, name: 'One', trackIDs: ['a', 'b', 'c'] },
  { id: 2, name: 'Two', trackIDs: ['a', 'b'] },
  { id: 3, name: 'Three', trackIDs: ['a', 'b', 'd'] },
  { id: 4, name: 'Solo', trackIDs: ['d', 'z'] },
]

// Degrees: a=3, b=3, d=2, c=1, z=1. Only a, b and d clear the degree-2 prefilter.
// Pair counts: a:b = 3, a:d = 1, b:d = 1.
const INDEX = buildIndex(PLAYLISTS)
const EMPTY_SCOPE: CursorScope = { subject: null, ids: [] }

function controls(patch: Partial<OverlapControls> = {}): OverlapControls {
  return {
    axis: 'track',
    measure: 'ratio',
    threshold: 0,
    sortKey: 'together',
    sortDir: 'desc',
    ...patch,
  }
}

function measure(row: ResultRow, key: string): number {
  const found = row.measures.find((m) => m.key === key)
  if (!found) throw new Error(`no measure ${key}`)
  return found.value
}

describe('scanTrackOverlap', () => {
  it('counts how many playlists two tracks share', () => {
    const { rows } = scanTrackOverlap(INDEX, controls(), EMPTY_SCOPE)
    const ab = rows.find((r) => r.key === 'a:b')
    expect(measure(ab!, 'together')).toBe(3)
    expect(measure(ab!, 'ratio')).toBeCloseTo(1)
  })

  it('excludes tracks appearing in only one playlist', () => {
    const { rows } = scanTrackOverlap(INDEX, controls(), EMPTY_SCOPE)
    expect(rows.some((r) => r.key.includes('z'))).toBe(false)
    expect(rows.some((r) => r.key.includes('c'))).toBe(false)
  })

  it('gives every row a denominator against the rarer track', () => {
    const { rows } = scanTrackOverlap(INDEX, controls(), EMPTY_SCOPE)
    const ab = rows.find((r) => r.key === 'a:b')
    expect(ab!.denominator).toBe('3 of 3')
  })

  it('leaves primaryLabel empty for the main thread to hydrate', () => {
    const { rows } = scanTrackOverlap(INDEX, controls(), EMPTY_SCOPE)
    expect(rows[0]!.primaryLabel).toBe('')
    expect(rows[0]!.memberIds).toHaveLength(2)
  })

  it('excludes oversized playlists and names them in a note', () => {
    const big: IndexInput = {
      id: 9,
      name: 'Everything',
      trackIDs: Array.from({ length: TRACK_AXIS_MAX_SIZE + 1 }, (_, i) => `big-${i}`),
    }
    const index = buildIndex([...PLAYLISTS, big])
    const { notes } = scanTrackOverlap(index, controls(), EMPTY_SCOPE)
    const note = notes.find((n) => n.kind === 'excluded-playlists')
    expect(note).toBeDefined()
    expect(note!.message).toContain('Everything')
    expect(note!.count).toBe(1)
  })

  it('scopes to a single playlist when the cursor holds one', () => {
    const scope: CursorScope = { subject: 'playlist', ids: ['2'] }
    const { rows } = scanTrackOverlap(INDEX, controls(), scope)
    expect(rows.map((r) => r.key)).toEqual(['a:b'])
    expect(measure(rows[0]!, 'together')).toBe(1)
  })

  it('keeps only pairs including a cursor track', () => {
    const scope: CursorScope = { subject: 'track', ids: ['d'] }
    const { rows } = scanTrackOverlap(INDEX, controls(), scope)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.memberIds.includes('d'))).toBe(true)
  })

  it('reports the pre-threshold pair count', () => {
    const { notes } = scanTrackOverlap(INDEX, controls({ threshold: 2 }), EMPTY_SCOPE)
    expect(notes.find((n) => n.kind === 'pre-threshold-count')?.count).toBeGreaterThan(0)
  })
})

describe('hydrateTrackLabels', () => {
  it('fills primaryLabel from the track map', () => {
    const { rows } = scanTrackOverlap(INDEX, controls(), EMPTY_SCOPE)
    const tracks = new Map([
      ['a', { title: 'Anytime', artist: 'Journey' }],
      ['b', { title: 'Feeling That Way', artist: 'Journey' }],
      ['d', { title: 'Lights', artist: 'Journey' }],
    ])
    const hydrated = hydrateTrackLabels(rows, tracks)
    const ab = hydrated.find((r) => r.key === 'a:b')
    expect(ab!.primaryLabel).toBe('Anytime + Feeling That Way')
    expect(ab!.secondaryLabel).toBe('Journey')
  })

  it('falls back to the track id when a track is missing', () => {
    const { rows } = scanTrackOverlap(INDEX, controls(), EMPTY_SCOPE)
    const hydrated = hydrateTrackLabels(rows, new Map())
    expect(hydrated[0]!.primaryLabel).toContain('a')
  })

  it('leaves playlist rows untouched', () => {
    const playlistRow: ResultRow = {
      key: '1:2',
      subject: 'playlist',
      primaryLabel: 'One <-> Two',
      measures: [],
      denominator: '1 of 2',
      memberIds: ['1', '2'],
    }
    expect(hydrateTrackLabels([playlistRow], new Map())[0]!.primaryLabel).toBe('One <-> Two')
  })
})
