import { UNKNOWN_GENRE } from '@/types/history'
import type { Breakdown, ChartData, ChartSeries, LibrarySnapshot, SnapshotStats } from '@/types/history'
import { rankCategories } from '@/utils/librarySnapshot'

// Categorical slots, stepped for a dark surface and checked against --color-surface (#272727):
// every adjacent pair clears the colorblind and normal-vision separation floors.
// Assign in this order, never cycled. A ninth category folds into Other.
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] as const

// Neutrals for buckets that are not a real category: Other, Unknown, no playlist.
export const OTHER_COLOR = '#8a8983'
export const UNKNOWN_COLOR = '#5c5b57'

export const OTHER_KEY = 'Other'

export const BREAKDOWNS: ReadonlyArray<{ key: Breakdown; label: string }> = [
  { key: 'duplication', label: 'By playlist count' },
  { key: 'source', label: 'By source' },
  { key: 'genre', label: 'By genre' },
]

/**
 * Splits each snapshot's unique tracks into parts that sum to its track count.
 * Category colors come from a ranking over every snapshot, so a color stays with its
 * category as snapshots are added or removed.
 */
export function compositionChart(snapshots: readonly LibrarySnapshot[], breakdown: Breakdown): ChartData {
  if (breakdown === 'duplication') {
    return {
      series: [
        { key: 'one', label: 'In one playlist', color: SERIES_COLORS[0] },
        { key: 'many', label: 'In 2+ playlists', color: SERIES_COLORS[1] },
        { key: 'none', label: 'In no playlist', color: OTHER_COLOR },
      ],
      points: snapshots.map((s) => ({
        t: s.takenAt,
        values: [s.stats.inOnePlaylist, s.stats.inManyPlaylists, s.stats.orphans],
      })),
    }
  }
  const pick = (st: SnapshotStats) => (breakdown === 'source' ? st.bySource : st.byGenre)
  const unknownKey = breakdown === 'source' ? 'unknown' : UNKNOWN_GENRE
  return categoryChart(snapshots.map((s) => s.takenAt), snapshots.map((s) => pick(s.stats)), unknownKey)
}

function categoryChart(times: number[], maps: Record<string, number>[], unknownKey: string): ChartData {
  const ranked = rankCategories(maps, [unknownKey])
  const named = ranked.filter((k) => k !== unknownKey)
  const shown = named.slice(0, SERIES_COLORS.length)
  const folded = new Set(named.slice(SERIES_COLORS.length))
  const hasUnknown = ranked.includes(unknownKey)

  const series: ChartSeries[] = shown.map((k, i) => ({ key: k, label: k, color: SERIES_COLORS[i]! }))
  if (folded.size) series.push({ key: OTHER_KEY, label: `Other (${folded.size})`, color: OTHER_COLOR })
  if (hasUnknown) series.push({ key: unknownKey, label: 'Unknown', color: UNKNOWN_COLOR })

  const points = maps.map((m, i) => {
    const values = shown.map((k) => m[k] ?? 0)
    if (folded.size) {
      let other = 0
      for (const k of folded) other += m[k] ?? 0
      values.push(other)
    }
    if (hasUnknown) values.push(m[unknownKey] ?? 0)
    return { t: times[i]!, values }
  })
  return { series, points }
}

/** Three duplication measures over time, all counted in playlist slots or tracks. */
export function duplicationChart(snapshots: readonly LibrarySnapshot[]): ChartData {
  return {
    series: [
      { key: 'dupEntries', label: 'Duplicate entries', color: SERIES_COLORS[0] },
      { key: 'many', label: 'Tracks in 2+ playlists', color: SERIES_COLORS[1] },
      { key: 'within', label: 'Repeats inside a playlist', color: SERIES_COLORS[2] },
    ],
    points: snapshots.map((s) => ({
      t: s.takenAt,
      values: [s.stats.duplicateEntries, s.stats.inManyPlaylists, s.stats.withinPlaylistDuplicates],
    })),
  }
}

/** Playlist count over time. */
export function playlistsChart(snapshots: readonly LibrarySnapshot[]): ChartData {
  return {
    series: [{ key: 'playlists', label: 'Playlists', color: SERIES_COLORS[0] }],
    points: snapshots.map((s) => ({ t: s.takenAt, values: [s.stats.playlists] })),
  }
}
