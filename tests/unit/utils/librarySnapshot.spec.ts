import { describe, it, expect } from 'vitest'
import { diffSnapshots, niceTicks, parseSnapshot, rankCategories, sortSnapshots } from '@/utils/librarySnapshot'

const meta = { fileName: 'a.json', lastModified: Date.parse('2026-01-01T00:00:00Z') }

function track(id: string, extra: Record<string, unknown> = {}) {
  return { trackID: id, title: id, artist: `artist-${id}`, album: `album-${id}`, source: 'spotify', ...extra }
}

function bundle(over: Record<string, unknown> = {}) {
  return {
    exportedAt: '2026-09-02T05:00:00.000Z',
    tracks: [track('t1'), track('t2'), track('t3'), track('t4')],
    playlists: [
      { name: 'A', trackIDs: ['t1', 't2', 't2'] },
      { name: 'B', trackIDs: ['t2', 't3'], playlistURI: 'spotify:playlist:b' },
    ],
    ...over,
  }
}

describe('parseSnapshot', () => {
  it('counts tracks, entries and each kind of duplication', () => {
    const { snapshot, warnings } = parseSnapshot(bundle(), meta)
    expect(warnings).toEqual([])
    expect(snapshot.stats).toMatchObject({
      tracks: 4,
      playlists: 2,
      entries: 5,
      referenced: 3,
      inOnePlaylist: 2,
      inManyPlaylists: 1,
      orphans: 1,
      missing: 0,
      duplicateEntries: 2,
      withinPlaylistDuplicates: 1,
      artists: 4,
      albums: 4,
    })
  })

  it('dates the snapshot by exportedAt', () => {
    const { snapshot } = parseSnapshot(bundle(), meta)
    expect(snapshot.takenAt).toBe(Date.parse('2026-09-02T05:00:00.000Z'))
    expect(snapshot.takenAtSource).toBe('exportedAt')
  })

  it('falls back to the file modified time and warns when exportedAt is invalid', () => {
    const { snapshot, warnings } = parseSnapshot(bundle({ exportedAt: 'soon' }), meta)
    expect(snapshot.takenAt).toBe(meta.lastModified)
    expect(snapshot.takenAtSource).toBe('fileModified')
    expect(warnings[0]).toMatch(/exportedAt/)
  })

  it('throws when the value is not a bundle', () => {
    expect(() => parseSnapshot([], meta)).toThrow(/object/)
    expect(() => parseSnapshot({ playlists: [] }, meta)).toThrow(/tracks/)
    expect(() => parseSnapshot({ tracks: [] }, meta)).toThrow(/playlists/)
  })

  it('skips malformed rows and repeated tracks with warnings', () => {
    const data = bundle({
      tracks: [track('t1'), track('t1'), { title: 'no id' }, null],
      playlists: [{ name: 'A', trackIDs: ['t1', 42] }, { trackIDs: [] }],
    })
    const { snapshot, warnings } = parseSnapshot(data, meta)
    expect(snapshot.stats.tracks).toBe(1)
    expect(snapshot.stats.playlists).toBe(1)
    expect(snapshot.stats.entries).toBe(1)
    expect(warnings).toHaveLength(3)
  })

  it('counts playlist tracks the tracks array lacks as missing', () => {
    const data = bundle({ tracks: [track('t1')], playlists: [{ name: 'A', trackIDs: ['t1', 'ghost'] }] })
    const { snapshot, warnings } = parseSnapshot(data, meta)
    expect(snapshot.stats.missing).toBe(1)
    expect(warnings.some((w) => w.includes('not in the tracks array'))).toBe(true)
  })

  it('buckets source and genre, with no genre counted as Unknown', () => {
    const data = bundle({ tracks: [track('t1', { genre: 'Rock' }), track('t2', { source: 'csv' }), track('t3', { source: '' })] })
    const { stats } = parseSnapshot(data, meta).snapshot
    expect(stats.byGenre).toEqual({ Rock: 1, Unknown: 2 })
    expect(stats.bySource).toEqual({ spotify: 1, csv: 1, unknown: 1 })
  })

  it('sums durations and ignores bad ones', () => {
    const data = bundle({ tracks: [track('t1', { duration: 1000 }), track('t2', { duration: 'x' }), track('t3', { duration: -5 })] })
    expect(parseSnapshot(data, meta).snapshot.stats.durationMs).toBe(1000)
  })

  it('gives the same fingerprint whatever the track order', () => {
    const a = parseSnapshot(bundle(), meta).snapshot.id
    const reversed = bundle()
    reversed.tracks.reverse()
    expect(parseSnapshot(reversed, meta).snapshot.id).toBe(a)
  })

  it('gives a different fingerprint when one track changes', () => {
    const a = parseSnapshot(bundle(), meta).snapshot.id
    const changed = bundle({ tracks: [track('t1'), track('t2'), track('t3'), track('t5')] })
    expect(parseSnapshot(changed, meta).snapshot.id).not.toBe(a)
  })

  it('keys playlists by URI, else by name', () => {
    const { playlistKeys } = parseSnapshot(bundle(), meta).snapshot
    expect([...playlistKeys]).toEqual(['A', 'spotify:playlist:b'])
  })
})

describe('diffSnapshots', () => {
  it('counts tracks and playlists added and removed', () => {
    const prev = parseSnapshot(bundle(), meta).snapshot
    const next = parseSnapshot(bundle({
      tracks: [track('t1'), track('t2'), track('t5'), track('t6'), track('t7')],
      playlists: [{ name: 'A', trackIDs: ['t1'] }, { name: 'C', trackIDs: ['t5'] }],
    }), meta).snapshot
    expect(diffSnapshots(prev, next)).toEqual({ tracksAdded: 3, tracksRemoved: 2, playlistsAdded: 1, playlistsRemoved: 1 })
  })
})

describe('sortSnapshots', () => {
  it('orders oldest first without touching the input', () => {
    const late = parseSnapshot(bundle({ exportedAt: '2026-10-01T00:00:00Z' }), meta).snapshot
    const early = parseSnapshot(bundle({ exportedAt: '2026-08-01T00:00:00Z' }), meta).snapshot
    const input = [late, early]
    expect(sortSnapshots(input)).toEqual([early, late])
    expect(input[0]).toBe(late)
  })
})

describe('rankCategories', () => {
  it('ranks by peak count across maps and puts listed keys last', () => {
    const ranked = rankCategories([{ a: 1, b: 5, Unknown: 99 }, { a: 7, c: 2 }], ['Unknown'])
    expect(ranked).toEqual(['a', 'b', 'c', 'Unknown'])
  })
})

describe('niceTicks', () => {
  it('returns round steps that reach the max', () => {
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(101)).toEqual([0, 50, 100, 150])
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8])
  })

  it('returns a unit axis for zero', () => {
    expect(niceTicks(0)).toEqual([0, 1])
  })
})
