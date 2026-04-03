import { db } from '@/db'
import { triggerDownload } from '@/utils/download'
import type { Track, Playlist } from '@/types/models'
import type { ExportAdapter, ExportResult, ProgressCallback } from '@/types/adapters'

export interface CsvExportOptions {
  playlistIds: number[] | 'all'
  profile: 'full' | 'minimal'
}

const FULL_FIELDS: string[] = [
  'trackID',
  'title',
  'artist',
  'album',
  'source',
  'spotifyURI',
  'duration',
  'genre',
  'bpm',
  'energy',
]

const MINIMAL_FIELDS: string[] = ['title', 'artist', 'album']

/** Utility function to serialize a value for CSV output, adding quotes if it contains special characters */
function serializeCsvValue(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

/** Generates a CSV string from an array of tracks based on the specified profile */
export function generateCsv(tracks: Track[], profile: 'full' | 'minimal'): string {
  const fields = profile === 'full' ? FULL_FIELDS : MINIMAL_FIELDS
  const header = fields.join(',')
  const rows = tracks.map((track) =>
    fields.map((field) => serializeCsvValue((track as Record<string, unknown>)[field])).join(','),
  )
  return [header, ...rows].join('\n')
}

/**
 * Export adapter for CSV files.
 * Supports exporting either all playlists or a selected subset, with progress reporting and error handling. 
 * The generated CSV files are automatically downloaded to the user's device, using triggerDownload utility. 
 */
export const csvExportAdapter: ExportAdapter<CsvExportOptions> = {
  key: 'csv',
  label: 'CSV File',
  
  async export(options: CsvExportOptions, onProgress?: ProgressCallback): Promise<ExportResult> {

    // Fetch playlists to export based on options: all or given playlist IDs
    let playlists: Playlist[]
    if (options.playlistIds === 'all') {
      playlists = await db.playlists.toArray()
    } else {
      // Fetch each playlist corresponding to a provided ID and filter out any that don't exist
      const results = await Promise.all(options.playlistIds.map((id) => db.playlists.get(id)))
      playlists = results.filter((p): p is Playlist => p !== undefined)
    }

    const errors: string[] = []

    // Process each playlist sequentially, generating CSV, triggering download, and reporting progress
    for (const [i, playlist] of playlists.entries()) {

      // Fetch tracks for the current playlist using trackIDs, ensuring we only include valid tracks
      const trackResults = await db.tracks.bulkGet(playlist.trackIDs)
      const tracks = trackResults.filter((t): t is Track => t !== undefined)
      const csv = generateCsv(tracks, options.profile)

      triggerDownload(`${playlist.name}.csv`, csv, 'text/csv')

      // Report progress after each playlist is processed
      if (onProgress) {
        onProgress(i + 1, playlists.length)
      }
    }

    return { playlistsExported: playlists.length, errors }
  },
}
