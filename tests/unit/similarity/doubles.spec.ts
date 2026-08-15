import { describe, it, expect } from 'vitest'
import { buildIndex } from '@/similarity/invertedIndex'
import { detectGroups, buildDoublesRows, tierRank, type ScannableGroup } from '@/similarity/doubles'
import { MAX_BLOCK_SIZE } from '@/similarity/constants'
import type {
  CursorScope,
  DoublesControls,
  KnownGroup,
  ScanNote,
  TrackMatchInput,
} from '@/similarity/types'

const EMPTY_SCOPE: CursorScope = { subject: null, ids: [] }

function controls(patch: Partial<DoublesControls> = {}): DoublesControls {
  return { reviewFilter: 'all', minTier: 'low', sortKey: 'variants', sortDir: 'desc', ...patch }
}

function track(
  trackID: string,
  title: string,
  artist: string,
  duration?: number | string,
): TrackMatchInput {
  return { trackID, title, artist, duration }
}

describe('detectGroups', () => {
  it('groups two releases of one recording at high confidence', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [track('a', 'Respect', 'Aretha Franklin'), track('b', 'Respect - 2005 Remaster', 'Aretha Franklin')],
      [],
      notes,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]!.trackIds.sort()).toEqual(['a', 'b'])
    expect(groups[0]!.matchTier).toBe('high')
  })

  it('rates a cover by a different artist as moderate', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [track('a', 'Respect', 'Aretha Franklin'), track('b', 'Respect', 'Otis Redding')],
      [],
      notes,
    )
    expect(groups[0]!.matchTier).toBe('moderate')
  })

  it('never groups two genuinely different songs', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [track('a', 'Respect', 'Aretha Franklin'), track('b', 'Superstition', 'Stevie Wonder')],
      [],
      notes,
    )
    expect(groups).toHaveLength(0)
  })

  it('discards a group of one', () => {
    const notes: ScanNote[] = []
    expect(detectGroups([track('a', 'Alone', 'Nobody')], [], notes)).toHaveLength(0)
  })

  it('promotes one tier when durations agree', () => {
    const notes: ScanNote[] = []
    const withoutDuration = detectGroups(
      [track('a', 'Respect', 'Aretha Franklin'), track('b', 'Respect', 'Otis Redding')],
      [],
      notes,
    )
    expect(withoutDuration[0]!.matchTier).toBe('moderate')

    const withDuration = detectGroups(
      [
        track('a', 'Respect', 'Aretha Franklin', 145000),
        track('b', 'Respect', 'Otis Redding', 145500),
      ],
      [],
      notes,
    )
    expect(withDuration[0]!.matchTier).toBe('high')
  })

  it('does not promote when durations disagree', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [
        track('a', 'Respect', 'Aretha Franklin', 145000),
        track('b', 'Respect', 'Otis Redding', 220000),
      ],
      [],
      notes,
    )
    expect(groups[0]!.matchTier).toBe('moderate')
  })

  it('accepts a duration stored as a string, as real exports do', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [
        track('a', 'Respect', 'Aretha Franklin', '145000'),
        track('b', 'Respect', 'Otis Redding', '145500'),
      ],
      [],
      notes,
    )
    expect(groups[0]!.matchTier).toBe('high')
  })

  it('merges transitively: A matches B and B matches C gives one group of three', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [
        track('a', 'Respect', 'Aretha Franklin'),
        track('b', 'Respect - Live', 'Aretha Franklin'),
        track('c', 'Respect - 2005 Remaster', 'Aretha Franklin'),
      ],
      [],
      notes,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]!.trackIds).toHaveLength(3)
  })

  it('takes the weakest pair tier as the group tier', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [
        track('a', 'Respect', 'Aretha Franklin'),
        track('b', 'Respect - Live', 'Aretha Franklin'),
        track('c', 'Respect', 'Otis Redding'),
      ],
      [],
      notes,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]!.matchTier).toBe('moderate')
  })

  it('skips tracks already inside a confirmed group', () => {
    const notes: ScanNote[] = []
    const known: KnownGroup[] = [{ trackIds: ['a', 'b'], status: 'confirmed' }]
    const groups = detectGroups(
      [track('a', 'Respect', 'Aretha Franklin'), track('b', 'Respect', 'Aretha Franklin')],
      known,
      notes,
    )
    expect(groups).toHaveLength(0)
  })

  it('skips tracks already inside a rejected group, so a rescan never re-proposes it', () => {
    const notes: ScanNote[] = []
    const known: KnownGroup[] = [{ trackIds: ['a', 'b'], status: 'rejected' }]
    const groups = detectGroups(
      [track('a', 'Respect', 'Aretha Franklin'), track('b', 'Respect', 'Aretha Franklin')],
      known,
      notes,
    )
    expect(groups).toHaveLength(0)
  })

  it('still considers tracks in an unconfirmed group', () => {
    const notes: ScanNote[] = []
    const known: KnownGroup[] = [{ trackIds: ['a', 'b'], status: 'unconfirmed' }]
    const groups = detectGroups(
      [track('a', 'Respect', 'Aretha Franklin'), track('b', 'Respect', 'Aretha Franklin')],
      known,
      notes,
    )
    expect(groups).toHaveLength(1)
  })

  it('excludes placeholder metadata and reports it', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [
        track('a', 'undefined', 'undefined'),
        track('b', 'undefined', 'undefined'),
        track('c', 'undefined', 'undefined'),
      ],
      [],
      notes,
    )
    expect(groups).toHaveLength(0)
    const note = notes.find((n) => n.kind === 'unmatchable-tracks')
    expect(note?.count).toBe(3)
  })

  it('skips an oversized title block and names it', () => {
    const notes: ScanNote[] = []
    const many = Array.from({ length: MAX_BLOCK_SIZE + 1 }, (_, i) =>
      track(`t${i}`, 'Untitled', `Artist ${i}`),
    )
    const groups = detectGroups(many, [], notes)
    expect(groups).toHaveLength(0)
    expect(notes.find((n) => n.kind === 'oversized-block')?.count).toBe(1)
  })

  it('matches a duo credit against the lead artist alone', () => {
    const notes: ScanNote[] = []
    const groups = detectGroups(
      [track('a', 'Sunny', 'Boney M., Connor Price'), track('b', 'Sunny', 'Boney M.')],
      [],
      notes,
    )
    expect(groups[0]!.matchTier).toBe('high')
  })
})

describe('buildDoublesRows', () => {
  const INDEX = buildIndex([
    { id: 1, name: 'One', trackIDs: ['a', 'b'] },
    { id: 2, name: 'Two', trackIDs: ['c'] },
  ])

  const TRACKS = new Map<string, TrackMatchInput>([
    ['a', track('a', 'Respect', 'Aretha Franklin')],
    ['b', track('b', 'Respect - Live', 'Aretha Franklin')],
    ['c', track('c', 'Superstition', 'Stevie Wonder')],
  ])

  const GROUPS: ScannableGroup[] = [
    { id: 1, trackIds: ['a', 'b'], matchTier: 'high', status: 'unconfirmed' },
    { id: 2, trackIds: ['c'], matchTier: 'low', status: 'confirmed' },
  ]

  it('renders one row per group in the shared ResultRow shape', () => {
    const notes: ScanNote[] = []
    const { rows } = buildDoublesRows(GROUPS, TRACKS, INDEX, controls(), EMPTY_SCOPE, notes)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.measures.map((m) => m.key)).toEqual(['variants', 'playlists', 'tier'])
  })

  it('labels a row with the preferred variant when one is set', () => {
    const notes: ScanNote[] = []
    const withPreferred: ScannableGroup[] = [
      { id: 1, trackIds: ['a', 'b'], matchTier: 'high', status: 'unconfirmed', preferredTrackId: 'b' },
    ]
    const { rows } = buildDoublesRows(withPreferred, TRACKS, INDEX, controls(), EMPTY_SCOPE, notes)
    expect(rows[0]!.primaryLabel).toBe('Respect - Live')
  })

  it('gives every row a denominator', () => {
    const notes: ScanNote[] = []
    const { rows } = buildDoublesRows(GROUPS, TRACKS, INDEX, controls(), EMPTY_SCOPE, notes)
    for (const row of rows) {
      expect(row.denominator).toMatch(/^\d+ variants across \d+ playlists$/)
    }
  })

  it('filters by review status', () => {
    const notes: ScanNote[] = []
    const { rows } = buildDoublesRows(
      GROUPS,
      TRACKS,
      INDEX,
      controls({ reviewFilter: 'confirmed' }),
      EMPTY_SCOPE,
      notes,
    )
    expect(rows.map((r) => r.key)).toEqual(['g2'])
  })

  it('filters by minimum tier', () => {
    const notes: ScanNote[] = []
    const { rows } = buildDoublesRows(
      GROUPS,
      TRACKS,
      INDEX,
      controls({ minTier: 'high' }),
      EMPTY_SCOPE,
      notes,
    )
    expect(rows.map((r) => r.key)).toEqual(['g1'])
  })

  it('scopes to groups touching a cursor playlist', () => {
    const notes: ScanNote[] = []
    const scope: CursorScope = { subject: 'playlist', ids: ['2'] }
    const { rows } = buildDoublesRows(GROUPS, TRACKS, INDEX, controls(), scope, notes)
    expect(rows.map((r) => r.key)).toEqual(['g2'])
  })

  it('scopes to groups containing a cursor track', () => {
    const notes: ScanNote[] = []
    const scope: CursorScope = { subject: 'track', ids: ['a'] }
    const { rows } = buildDoublesRows(GROUPS, TRACKS, INDEX, controls(), scope, notes)
    expect(rows.map((r) => r.key)).toEqual(['g1'])
  })

  it('reports how many groups matched the filter', () => {
    const notes: ScanNote[] = []
    buildDoublesRows(GROUPS, TRACKS, INDEX, controls(), EMPTY_SCOPE, notes)
    expect(notes.find((n) => n.kind === 'pre-threshold-count')?.count).toBe(2)
  })
})

describe('tierRank', () => {
  it('orders tiers weakest to strongest', () => {
    expect(tierRank('low')).toBeLessThan(tierRank('moderate'))
    expect(tierRank('moderate')).toBeLessThan(tierRank('high'))
    expect(tierRank('high')).toBeLessThan(tierRank('source'))
  })
})
