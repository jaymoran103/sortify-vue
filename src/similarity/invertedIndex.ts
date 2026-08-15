import type { IndexInput, InvertedIndex } from './types'

/**
 * Builds the inverted index every similarity scan reads.
 *
 * Input: playlists reduced to id, name and track IDs, and optionally a map folding equivalent
 * track IDs onto one canonical ID.
 * Output: an InvertedIndex mapping tracks to their owning playlists, plus per-playlist track sets
 * and both size readings.
 * Side effects: none. Pure and synchronous, so it is callable from a worker or a test alike.
 *
 * Playlist contents are treated as sets. The database does not manage duplicate track entries
 * within a playlist, so similarity math dedupes and keeps rawSizes to disclose where it did.
 *
 * When a canonical map is supplied, every variant of a confirmed doubles group collapses to one
 * ID before indexing. That is what makes two playlists holding different releases of the same
 * recording count as sharing it. rawSizes still reports the original entry count, so the dedupe
 * disclosure keeps telling the truth.
 */
export function buildIndex(
  playlists: IndexInput[],
  canonical?: Map<string, string>,
): InvertedIndex {
  const trackToPlaylists = new Map<string, number[]>()
  const playlistSets = new Map<number, Set<string>>()
  const playlistSizes = new Map<number, number>()
  const rawSizes = new Map<number, number>()
  const playlistNames = new Map<number, string>()

  for (const playlist of playlists) {
    const resolved = canonical
      ? playlist.trackIDs.map((id) => canonical.get(id) ?? id)
      : playlist.trackIDs
    const unique = new Set(resolved)
    playlistSets.set(playlist.id, unique)
    playlistSizes.set(playlist.id, unique.size)
    rawSizes.set(playlist.id, playlist.trackIDs.length)
    playlistNames.set(playlist.id, playlist.name)

    for (const trackID of unique) {
      const owners = trackToPlaylists.get(trackID)
      if (owners) owners.push(playlist.id)
      else trackToPlaylists.set(trackID, [playlist.id])
    }
  }

  return {
    trackToPlaylists,
    playlistSets,
    playlistSizes,
    rawSizes,
    playlistNames,
    builtAt: Date.now(),
  }
}
