import { UNKNOWN_GENRE } from '@/types/history'
import type { LibrarySnapshot, SnapshotDiff, SnapshotStats } from '@/types/history'

export interface SnapshotFileMeta {
  fileName: string
  lastModified: number      // File.lastModified, the fallback date when exportedAt is absent or invalid
}

export interface ParsedSnapshot {
  snapshot: LibrarySnapshot
  warnings: string[]
}

interface BundleTrack {
  trackID: string
  artist?: unknown
  album?: unknown
  source?: unknown
  genre?: unknown
  duration?: unknown
}

interface BundlePlaylist {
  name: string
  trackIDs: string[]
  playlistURI?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBundleTrack(value: unknown): value is BundleTrack {
  return isRecord(value) && typeof value.trackID === 'string' && value.trackID !== ''
}

function isBundlePlaylist(value: unknown): value is BundlePlaylist {
  return isRecord(value) && typeof value.name === 'string' && Array.isArray(value.trackIDs)
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

// FNV-1a, 32-bit. Combined by sum below so the fingerprint ignores track order.
function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/**
 * Reads one parsed JSON bundle into a snapshot.
 * Inputs: the parsed JSON value and the file's name and modified time.
 * Output: the snapshot plus warnings for anything skipped or assumed.
 * Throws when the value is not a bundle at all: not an object, or no tracks or playlists array.
 * Malformed entries inside the arrays are skipped and counted, never fatal.
 */
export function parseSnapshot(data: unknown, meta: SnapshotFileMeta): ParsedSnapshot {
  if (!isRecord(data)) throw new Error('Not a bundle: expected a JSON object')
  if (!Array.isArray(data.tracks)) throw new Error('Not a bundle: missing tracks array')
  if (!Array.isArray(data.playlists)) throw new Error('Not a bundle: missing playlists array')

  const warnings: string[] = []

  // The export date is the snapshot date. A bundle without one falls back to the file's
  // modified time, which a copy or download can change, so the fallback is flagged.
  const exportedAt = typeof data.exportedAt === 'string' ? Date.parse(data.exportedAt) : NaN
  const dated = Number.isFinite(exportedAt)
  if (!dated) warnings.push('No valid exportedAt. Dated by file modified time.')

  // Tracks: keep the first row per trackID.
  const tracks = new Map<string, BundleTrack>()
  let badTracks = 0
  let repeatedTracks = 0
  for (const row of data.tracks) {
    if (!isBundleTrack(row)) { badTracks++; continue }
    if (tracks.has(row.trackID)) { repeatedTracks++; continue }
    tracks.set(row.trackID, row)
  }
  if (badTracks) warnings.push(`Skipped ${plural(badTracks, 'track')} with no trackID.`)
  if (repeatedTracks) warnings.push(`Ignored ${plural(repeatedTracks, 'repeated track row')}.`)

  // Playlists: count each track's playlist memberships and the repeats inside each playlist.
  const membership = new Map<string, number>()
  const playlistKeys = new Set<string>()
  let playlists = 0
  let entries = 0
  let withinPlaylistDuplicates = 0
  let badPlaylists = 0
  for (const row of data.playlists) {
    if (!isBundlePlaylist(row)) { badPlaylists++; continue }
    playlists++
    playlistKeys.add(nonEmptyString(row.playlistURI) ?? row.name)
    const seen = new Set<string>()
    for (const id of row.trackIDs) {
      if (typeof id !== 'string') continue
      entries++
      if (seen.has(id)) { withinPlaylistDuplicates++; continue }
      seen.add(id)
      membership.set(id, (membership.get(id) ?? 0) + 1)
    }
  }
  if (badPlaylists) warnings.push(`Skipped ${plural(badPlaylists, 'playlist')} with no name or trackIDs.`)

  let inOnePlaylist = 0
  let inManyPlaylists = 0
  let orphans = 0
  let durationMs = 0
  let idHash = 0
  const artists = new Set<string>()
  const albums = new Set<string>()
  const bySource: Record<string, number> = {}
  const byGenre: Record<string, number> = {}

  for (const [id, t] of tracks) {
    const count = membership.get(id) ?? 0
    if (count === 0) orphans++
    else if (count === 1) inOnePlaylist++
    else inManyPlaylists++

    const artist = nonEmptyString(t.artist)
    if (artist) artists.add(artist.toLowerCase())
    const album = nonEmptyString(t.album)
    // An album name alone collides across artists, so key it by both.
    if (album) albums.add(`${artist?.toLowerCase() ?? ''}\u0000${album.toLowerCase()}`)
    if (typeof t.duration === 'number' && Number.isFinite(t.duration) && t.duration > 0) durationMs += t.duration

    const source = nonEmptyString(t.source) ?? 'unknown'
    bySource[source] = (bySource[source] ?? 0) + 1
    const genre = nonEmptyString(t.genre) ?? UNKNOWN_GENRE
    byGenre[genre] = (byGenre[genre] ?? 0) + 1

    idHash = (idHash + hashString(id)) >>> 0
  }

  let missing = 0
  for (const id of membership.keys()) if (!tracks.has(id)) missing++
  if (missing) warnings.push(`${plural(missing, 'playlist track')} not in the tracks array.`)

  const stats: SnapshotStats = {
    tracks: tracks.size,
    playlists,
    entries,
    referenced: membership.size,
    inOnePlaylist,
    inManyPlaylists,
    orphans,
    missing,
    duplicateEntries: entries - membership.size,
    withinPlaylistDuplicates,
    artists: artists.size,
    albums: albums.size,
    durationMs,
    bySource,
    byGenre,
  }

  const takenAt = dated ? exportedAt : meta.lastModified
  const id = [takenAt, stats.tracks, stats.playlists, stats.entries, idHash.toString(36)].join(':')

  return {
    snapshot: {
      id,
      fileName: meta.fileName,
      takenAt,
      takenAtSource: dated ? 'exportedAt' : 'fileModified',
      stats,
      trackIds: new Set(tracks.keys()),
      playlistKeys,
    },
    warnings,
  }
}

function countMissing<T>(from: ReadonlySet<T>, inSet: ReadonlySet<T>): number {
  let n = 0
  for (const item of from) if (!inSet.has(item)) n++
  return n
}

/** Counts tracks and playlists added and removed between two snapshots, by trackID and playlist key. */
export function diffSnapshots(prev: LibrarySnapshot, next: LibrarySnapshot): SnapshotDiff {
  return {
    tracksAdded: countMissing(next.trackIds, prev.trackIds),
    tracksRemoved: countMissing(prev.trackIds, next.trackIds),
    playlistsAdded: countMissing(next.playlistKeys, prev.playlistKeys),
    playlistsRemoved: countMissing(prev.playlistKeys, next.playlistKeys),
  }
}

/** Sorts snapshots oldest first. Ties keep import order. Returns a new array. */
export function sortSnapshots(snapshots: readonly LibrarySnapshot[]): LibrarySnapshot[] {
  return [...snapshots].sort((a, b) => a.takenAt - b.takenAt)
}

/**
 * Ranks the keys of a per-snapshot count map by their largest count in any snapshot.
 * Used to give categories a fixed order, and so a fixed color, across the whole set.
 * Keys in `last` sort after every other key whatever their size.
 */
export function rankCategories(maps: readonly Record<string, number>[], last: readonly string[] = []): string[] {
  const peak = new Map<string, number>()
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) peak.set(k, Math.max(peak.get(k) ?? 0, v))
  }
  return [...peak.keys()].sort((a, b) => {
    const al = last.includes(a), bl = last.includes(b)
    if (al !== bl) return al ? 1 : -1
    return (peak.get(b) ?? 0) - (peak.get(a) ?? 0) || a.localeCompare(b)
  })
}

/**
 * Returns round tick values from 0 to at least `max`, about `count` of them.
 * The last tick is the axis top.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((s) => s * mag >= raw) ?? 10) * mag
  const ticks: number[] = []
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Number(v.toPrecision(12)))
  return ticks
}
