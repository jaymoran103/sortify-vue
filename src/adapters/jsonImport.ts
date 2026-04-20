import { db } from '@/db'
import type { Track, Playlist } from '@/types/models'
import type { ImportAdapter, ImportResult, ProgressCallback } from '@/types/adapters'

export interface JsonImportOptions {
  file: File
}

/** Imports a JSON bundle containing tracks and playlists into the database.
 * Calls onProgress(index+1, total, playlist.name) after each playlist is written.
 */
export async function importJsonBundle(data: unknown, onProgress?: ProgressCallback): Promise<ImportResult> {

  // Validate the structure of the JSON bundle to ensure it contains the expected tracks and playlists arrays.
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid bundle: expected an object')
  }
  const bundle = data as Record<string, unknown>
  if (!Array.isArray(bundle.tracks)) {
    throw new Error('Invalid bundle: missing tracks array')
  }
  if (!Array.isArray(bundle.playlists)) {
    throw new Error('Invalid bundle: missing playlists array')
  }

  // Store the tracks in the database, using bulkPut for efficiency.
  await db.tracks.bulkPut(bundle.tracks as Track[])

  // Add playlists to the database, omitting any existing id fields to allow the database to generate new numeric IDs.
  // FUTURE: Consider handling ID conflicts more intelligently?
  const playlists = bundle.playlists as Array<Playlist>
  for (let i = 0; i < playlists.length; i++) {
    const pl = playlists[i]!
    const { id: _id, ...rest } = pl
    await db.playlists.add(rest as Omit<Playlist, 'id'>)
    onProgress?.(i + 1, playlists.length, pl.name)
  }

  return {
    tracksImported: (bundle.tracks as Track[]).length,
    playlistsImported: playlists.length,
    errors: [],
  }
}

/** 
 * Import adapter for JSON files
 * Reads a JSON file, parses it, and imports the contained tracks and playlists into the database. 
 * Validates the structure of the JSON bundle and returns import results including counts and any errors.
 */
export const jsonImportAdapter: ImportAdapter<JsonImportOptions> = {
  key: 'json',
  label: 'JSON Bundle',
  
  async import(options: JsonImportOptions, onProgress?: ProgressCallback): Promise<ImportResult> {
    const text = await options.file.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (err) {
      throw new Error(`Failed to parse JSON: ${(err as Error).message}`)
    }
    return importJsonBundle(data, onProgress)
  },
}
