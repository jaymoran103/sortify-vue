import { db } from '@/db'
import { triggerDownload } from '@/utils/download'
import type { Track, Playlist } from '@/types/models'
import type { ExportAdapter, ExportResult } from '@/types/adapters'

export interface JsonExportOptions {
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
 * Retrieves all tracks and playlists from the database, constructs a JSON bundle, and triggers a download of the JSON file. 
 * The filename can be customized via options or defaults to a timestamped name, currently not tested. 
 */
export const jsonExportAdapter: ExportAdapter<JsonExportOptions> = {
  key: 'json',
  label: 'JSON Bundle',
  async export(options: JsonExportOptions): Promise<ExportResult> {

    // Query all tracks and playlists from the database
    const tracks = await db.tracks.toArray()
    const playlists = await db.playlists.toArray()

    // Build a JSON bundle containing the tracks and playlists, 
    const bundle = buildJsonBundle(tracks, playlists)
    const content = JSON.stringify(bundle, null, 2)
    const filename = options.filename ?? `sortify-export-${new Date().toISOString().slice(0, 10)}.json`

    // Trigger a download of the JSON file with the constructed content and filename.
    triggerDownload(filename, content, 'application/json')
    return { playlistsExported: playlists.length, errors: [] }
  },
}
