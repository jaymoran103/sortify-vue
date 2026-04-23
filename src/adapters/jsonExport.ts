import { db } from '@/db'
import { triggerDownload } from '@/utils/download'
import type { Track, Playlist } from '@/types/models'
import type { ExportAdapter, ExportResult } from '@/types/adapters'

export interface JsonExportOptions {
  playlistIds: number[] | 'all'
  filename?: string
}

/** Structure of a JSON bundle containing exported tracks and playlists */
export interface JsonBundle {
  exportedAt: string
  tracks: Track[]
  playlists: Playlist[]
}

/** Utility function to build a JSON bundle containing tracks and playlists */
export function buildJsonBundle(tracks: Track[], playlists: Playlist[]): JsonBundle {
  return {
    exportedAt: new Date().toISOString(),
    tracks,
    playlists,
  }
}

/**
 * Export adapter for JSON files
 * Retrieves tracks and playlists from the database based on the selected playlist IDs,
 * constructs a JSON bundle, and triggers a download of the JSON file.
 * The filename can be customized via options or defaults to a timestamped name.
 */
export const jsonExportAdapter: ExportAdapter<JsonExportOptions> = {
  key: 'json',
  label: 'JSON Bundle',
  async export(options: JsonExportOptions): Promise<ExportResult> {

    // Fetch the selected playlists
    let playlists: Playlist[]
    if (options.playlistIds === 'all') {
      playlists = await db.playlists.toArray()
    } else {
      const results = await Promise.all(options.playlistIds.map((id) => db.playlists.get(id)))
      playlists = results.filter((p): p is Playlist => p !== undefined)
    }

    // Collect the union of all track IDs referenced by the selected playlists
    const referencedTrackIds = new Set(playlists.flatMap((p) => p.trackIDs))

    // Fetch only the referenced tracks
    const trackResults = await db.tracks.bulkGet([...referencedTrackIds])
    const tracks = trackResults.filter((t): t is Track => t !== undefined)

    // Build and download the JSON bundle
    const bundle = buildJsonBundle(tracks, playlists)
    const content = JSON.stringify(bundle, null, 2)
    const filename = options.filename ?? `sortify-export-${new Date().toISOString().slice(0, 10)}.json`

    triggerDownload(filename, content, 'application/json')
    return { playlistsExported: playlists.length, errors: [] }
  },
}
