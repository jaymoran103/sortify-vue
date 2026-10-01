import { describe, it, expect } from 'vitest'
import { compositionChart, duplicationChart, OTHER_COLOR, SERIES_COLORS, UNKNOWN_COLOR } from '@/utils/historySeries'
import { parseSnapshot } from '@/utils/librarySnapshot'

function snap(exportedAt: string, genres: (string | undefined)[]) {
  const tracks = genres.map((g, i) => ({ trackID: `t${i}`, title: '', artist: '', album: '', source: 'spotify', genre: g }))
  const data = { exportedAt, tracks, playlists: [{ name: 'A', trackIDs: tracks.map((t) => t.trackID) }] }
  return parseSnapshot(data, { fileName: 'x.json', lastModified: 0 }).snapshot
}

describe('compositionChart', () => {
  it('splits tracks by playlist count so the parts sum to the track count', () => {
    const s = snap('2026-01-01T00:00:00Z', [undefined, undefined])
    const chart = compositionChart([s], 'duplication')
    expect(chart.series.map((x) => x.key)).toEqual(['one', 'many', 'none'])
    expect(chart.points[0]!.values.reduce((a, b) => a + b, 0)).toBe(s.stats.tracks)
  })

  it('keeps a genre color fixed when a later snapshot reorders the genres', () => {
    const a = snap('2026-01-01T00:00:00Z', ['Rock', 'Rock', 'Jazz'])
    const b = snap('2026-02-01T00:00:00Z', ['Jazz', 'Jazz', 'Jazz', 'Rock'])
    const both = compositionChart([a, b], 'genre')
    const onlyB = compositionChart([b], 'genre')
    expect(both.series.find((s) => s.key === 'Jazz')!.color).toBe(SERIES_COLORS[0])
    expect(onlyB.series.find((s) => s.key === 'Jazz')!.color).toBe(SERIES_COLORS[0])
  })

  it('folds genres past the eighth into Other and puts Unknown last', () => {
    const genres = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', undefined]
    const chart = compositionChart([snap('2026-01-01T00:00:00Z', genres)], 'genre')
    expect(chart.series).toHaveLength(10)
    expect(chart.series[chart.series.length - 2]).toMatchObject({ key: 'Other', label: 'Other (2)', color: OTHER_COLOR })
    expect(chart.series[chart.series.length - 1]).toMatchObject({ key: 'Unknown', color: UNKNOWN_COLOR })
    expect(chart.points[0]!.values.reduce((a, b) => a + b, 0)).toBe(11)
  })
})

describe('duplicationChart', () => {
  it('reads three duplication measures per snapshot', () => {
    const s = snap('2026-01-01T00:00:00Z', [undefined])
    expect(duplicationChart([s]).points[0]!.values).toEqual([0, 0, 0])
  })
})
