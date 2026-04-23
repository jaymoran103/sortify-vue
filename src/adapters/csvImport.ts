import { db } from '@/db'
import type { Track, TrackSource } from '@/types/models'
import type { ImportAdapter, ImportResult, ProgressCallback } from '@/types/adapters'

export interface CsvImportOptions {
  files: File[]
}

// Standard fieldn name mappings for main CSV headers, allowing flexibility in input formats from various sources.
const FIELD_ALIASES: Record<string, string> = {
  trackid: 'trackID',
  uri: 'trackID',
  title: 'title',
  track_name: 'title',
  name: 'title',
  album: 'album',
  album_name: 'album',
  artist: 'artist',
  artist_name: 'artist',
  artists: 'artist',
  spotifyuri: 'spotifyURI',
  duration_ms: 'duration',
  popularity: 'popularity',
  explicit: 'explicit',
  genres: 'genre',
  genre: 'genre',
  danceability: 'danceability',
  energy: 'energy',
  key: 'key',
  loudness: 'loudness',
  mode: 'mode',
  speechiness: 'speechiness',
  acousticness: 'acousticness',
  instrumentalness: 'instrumentalness',
  liveness: 'liveness',
  valence: 'valence',
  tempo: 'tempo',
  bpm: 'bpm',
  time_signature: 'timeSignature',

  // Alternative headers from third party sources and vanilla app.
  'track uri': 'trackID',
  'track name': 'title',
  'time signature': 'timeSignature',
  'record label': 'recordLabel',
  'added at': 'addedAt',
  'artist name(s)': 'artist',
  'spotify uri': 'spotifyURI',
  'release date': 'releaseDate',
  'duration (ms)': 'duration',
  'album name': 'album',
}

// Core fields required for each track.
const CORE_FIELDS = new Set(['trackID', 'title', 'album', 'artist'])

// Utility function to generate a consistent trackID hash from title, artist, and album when no URI is provided.
export function hashTrackId(title: string, artist: string, album: string): string {
  const str = `${title}||${artist}||${album}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return `gen_${Math.abs(hash).toString(16)}`
}

// Regex for a well-formed Spotify track URI.
const SPOTIFY_TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]+$/

// Resolves the best spotifyURI for a track.
// Prefers an explicit spotifyURI field; falls back to trackID if it's a valid Spotify track URI.
// Returns undefined for non-Spotify tracks.
export function resolveSpotifyURI(trackID: string, explicitSpotifyURI: string | undefined): string | undefined {
  if (explicitSpotifyURI) return explicitSpotifyURI
  if (SPOTIFY_TRACK_URI_RE.test(trackID)) return trackID
  return undefined
}

// Parses a single CSV line into an array of values, handling quoted fields and escaped quotes. //TODO review comma handling and test more thoroughly for edge cases.
export function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  // Iterate through each character in the line, building fields based on commas and quotes
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    // Handle quotes: toggle inQuotes state, and handle escaped quotes by checking for double quotes
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } 
    // Handle commas: if not within quotes, treat as field separator
    else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } 
    // Regular character: add to current field
    else {
      current += char
    }
  }
  fields.push(current.trim())
  return fields
}

// Builds an index mapping standardized field names to their corresponding column indices based on the header row of the CSV.
function buildFieldIndex(headerRow: string[]): Record<string, number> {
  const index: Record<string, number> = {}

  // Iterate through the header row, normalizing each header and mapping it to a standardized field name using FIELD_ALIASES. Only include recognized fields in the index.
  for (const [i, raw] of headerRow.entries()) {
    const key = raw.toLowerCase().trim()
    const fieldName = FIELD_ALIASES[key]
    if (fieldName && !(fieldName in index)) {
      index[fieldName] = i
    }
  }
  return index
}

// Extracts track fields from a CSV row based on the provided field index, applying necessary transformations (e.g. replacing semicolons in artist names) and returning a standardized record of track properties.
function extractRow(columns: string[], fieldIndex: Record<string, number>): Record<string, string> {
  const fields: Record<string, string> = {}

  // Iterate through the field index, extracting values from the corresponding columns in the CSV row.
  for (const [fieldName, colIndex] of Object.entries(fieldIndex)) {
    const raw = columns[colIndex]

    // Skip empty values
    if (raw === undefined || raw === '') continue

    // Special handling for artist field to replace semicolons with commas for more natural display
    if (fieldName === 'artist') {
      fields[fieldName] = raw.replace(/;/g, ', ')
    } else {
      fields[fieldName] = raw
    }
  }
  return fields
}

// Determines the source of a track based on its trackID format, categorizing it as 'spotify' if it starts with 'spotify:', otherwise defaulting to 'csv'.
// FUTURE: is this the best place to determine source?
function determineSource(trackID: string): TrackSource {
  return trackID.startsWith('spotify:') ? 'spotify' : 'csv'
}

/**
 * Imports track data from CSV text, creating a new playlist with the given name.
 * Parses the CSV, extracts track information, generates trackIDs if necessary, and stores the tracks and playlist in the database. 
 * Returns a summary of the import results, including counts of tracks and playlists imported, as well as any errors encountered during parsing.
 * @param csvText 
 * @param playlistName 
 * @param onProgress 
 * @returns 
 */
export async function importCsvText(
  csvText: string,
  playlistName: string,
  onProgress?: ProgressCallback,
): Promise<ImportResult> {
  // Split the CSV text into lines, filtering out any empty lines. 
  // The first line is treated as the header, and the rest are data lines. 
  const [headerLine, ...dataLines] = csvText.split('\n').filter((l) => l.trim() !== '')
  // If either is missing, return an empty result.
  if (!headerLine || dataLines.length === 0) {
    return { tracksImported: 0, playlistsImported: 0, errors: [] }
  }

  // Parse the header line to build a field index, then extract track information from each data line using the field index.
  const headerRow = parseCSVLine(headerLine)
  const fieldIndex = buildFieldIndex(headerRow)
  const tracks: Track[] = []
  const errors: string[] = []

  // Iterate through each data line, parsing it into columns, extracting track fields, validating required fields, generating trackIDs if necessary, and building Track objects to be stored in the database.
  for (const [i, line] of dataLines.entries()) {
    if (onProgress) onProgress(i + 1, dataLines.length)

    //Parse the CSV line into columns, then extract fields based on the field index.
    const columns = parseCSVLine(line)
    const fields = extractRow(columns, fieldIndex)

    if (!fields.title) {
      errors.push(`Row ${i}: missing title, skipped`)
      continue
    }
    
    // Determine trackID: use provided trackID or spotifyURI if available, otherwise generate a hash-based ID from title, artist, and album. Skip local files.
    let trackID = fields.trackID
    if (!trackID && fields.spotifyURI) {
      trackID = fields.spotifyURI
    }
    if (!trackID) {
      trackID = hashTrackId(fields.title, fields.artist ?? '', fields.album ?? '')
    }
    if (trackID.includes(':local:')) continue

    // Determine track source based on trackID format, then build a Track object with the extracted fields and add it to the list of tracks to be imported.
    const source = determineSource(trackID)
    const track: Track = {
      trackID,
      title: fields.title,
      artist: fields.artist ?? '',
      album: fields.album ?? '',
      source,
    }
    const spotifyURI = resolveSpotifyURI(trackID, fields.spotifyURI)
    if (spotifyURI) track.spotifyURI = spotifyURI

    // Include any additional fields that were extracted and are not part of the core required fields.
    for (const [key, val] of Object.entries(fields)) {
      if (!CORE_FIELDS.has(key) && key !== 'spotifyURI' && val) {
        track[key] = val
      }
    }

    tracks.push(track)
  }

  // Deduplicate tracks by trackID to avoid importing duplicates, then store the unique tracks and create a new playlist with the imported trackIDs.
  const seen = new Map<string, Track>()
  for (const t of tracks) {
    if (!seen.has(t.trackID)) seen.set(t.trackID, t)
  }
  const unique = [...seen.values()]
  const uniqueIds = [...seen.keys()]

  // Store the unique tracks in the database, then create a new playlist referencing those trackIDs. 
  await db.tracks.bulkPut(unique)
  await db.playlists.add({
    name: playlistName,
    trackIDs: uniqueIds,
    timeAdded: Date.now(),
    lastModified: Date.now(),
  })

  // Return the import results including counts and any errors.
  return {
    tracksImported: unique.length,
    playlistsImported: 1,
    errors,
  }
}


/**
 * Import adapter for CSV files. 
 * Supports importing multiple CSV files at once, with progress reporting and error handling. 
 * Each CSV file is parsed to extract track information, which is then stored in the database. 
 */
export const csvImportAdapter: ImportAdapter<CsvImportOptions> = {
  key: 'csv',
  label: 'CSV File',
  async import(options: CsvImportOptions, onProgress?: ProgressCallback): Promise<ImportResult> {
    let totalTracksImported = 0
    let totalPlaylistsImported = 0
    const allErrors: string[] = []

    for (let fileIdx = 0; fileIdx < options.files.length; fileIdx++) {
      const file = options.files[fileIdx]!
      const text = await file.text()
      const playlistName = file.name.replace(/\.csv$/i, '')
      // Normalise per-file row-level progress into a 0→N scale (N = file count) so the caller
      // receives smooth overall progress rather than a 0→1 reset for each file.

      // Normalize per-file progress into a 0->N scale, so the progress callback receives smoother overall progress throughout the batch. 
      // This method doesn't differentiate between row types. Treating all CSV and JSON files as the same weight may mean the normalized progress may not be linear, with consistent steps but variable waits between them, especially during the JSON batch.
      // More accurate updates would require more adapter overhead, this caveat isn't a concern here. FUTURE: Generalize units. May estimate total tracks, sniff json files and adjust weight accordingly, or find a more granular unit to report on.  
      const wrappedProgress = onProgress
        ? (rowDone: number, rowTotal: number) => {
            const fraction = rowTotal > 0 ? rowDone / rowTotal : 0
            onProgress(fileIdx + fraction, options.files.length, playlistName)
          }
        : undefined
      const result = await importCsvText(text, playlistName, wrappedProgress)
      totalTracksImported += result.tracksImported
      totalPlaylistsImported += result.playlistsImported
      allErrors.push(...result.errors)
    }
    if (onProgress) onProgress(options.files.length, options.files.length)

    return {
      tracksImported: totalTracksImported,
      playlistsImported: totalPlaylistsImported,
      errors: allErrors,
    }
  },
}
