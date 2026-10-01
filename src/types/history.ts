// Types for the library history prototype: snapshots read from JSON bundles, compared over time.

// Counts computed from one bundle. Every figure refers to that bundle alone.
export interface SnapshotStats {
  tracks: number            // unique trackIDs in the bundle's tracks array
  playlists: number
  entries: number           // every playlist slot, duplicates included
  referenced: number        // unique trackIDs across all playlists
  inOnePlaylist: number     // tracks present in exactly one playlist
  inManyPlaylists: number   // tracks present in two or more playlists
  orphans: number           // tracks in the tracks array that no playlist holds
  missing: number           // trackIDs a playlist holds that the tracks array lacks
  duplicateEntries: number  // entries - referenced: every slot beyond a track's first
  withinPlaylistDuplicates: number // slots repeating a track already in the same playlist
  artists: number
  albums: number
  durationMs: number        // summed over unique tracks with a duration
  bySource: Record<string, number>
  byGenre: Record<string, number>  // tracks with no genre count under UNKNOWN_GENRE
}

// One imported bundle. Raw tracks are dropped after import; only what the views need is kept.
export interface LibrarySnapshot {
  id: string                // fingerprint, also used to skip a file imported twice
  fileName: string
  takenAt: number           // epoch ms
  takenAtSource: 'exportedAt' | 'fileModified'
  stats: SnapshotStats
  trackIds: ReadonlySet<string>
  playlistKeys: ReadonlySet<string> // playlistURI when present, else name
}

// Change from the previous snapshot in date order. Absent on the first snapshot.
export interface SnapshotDiff {
  tracksAdded: number
  tracksRemoved: number
  playlistsAdded: number
  playlistsRemoved: number
}

// Outcome of reading one file. A file can produce a snapshot and still carry warnings.
export interface SnapshotFileReport {
  fileName: string
  status: 'added' | 'duplicate' | 'error'
  message?: string
  warnings: string[]
}

export const UNKNOWN_GENRE = 'Unknown'

// Chart input shared by the history series builders and TimeSeriesChart.
export type Breakdown = 'duplication' | 'source' | 'genre'

export interface ChartSeries {
  key: string
  label: string
  color: string
}

export interface ChartPoint {
  t: number                 // epoch ms
  values: number[]          // one per series, in series order
}

export interface ChartData {
  series: ChartSeries[]
  points: ChartPoint[]
}
