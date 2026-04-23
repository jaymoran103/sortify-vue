import { db } from '@/db'
import type { Track } from '@/types/models'
import type { ExportAdapter, ExportResult } from '@/types/adapters'
import { spotifyAuth } from '@/spotify/auth'
import { spotifyApi } from '@/spotify/api'
import { SLEEP_BETWEEN_PLAYLISTS_MS } from '@/spotify/config'

//TODO: add as optional input
// const PREFIX_PLAYLIST_NAME = '[Sortify] - '
const PREFIX_PLAYLIST_NAME = ''
const PLAYLIST_DESCRIPTION = 'Exported from Sortify'
// const PLAYLIST_DESCRIPTION = 'Exported from Sortify - jaymoran103.github.io/sortify-vue'

export interface SpotifyExportOptions {
  playlistIds: number[]
}

interface SpotifyCreatePlaylistResponse {
  id: string
  external_urls: { spotify: string }
  name: string
}

// const CHUNK_SIZE = 100
const CHUNK_SIZE = 50

function logInfo(message: string, details?: unknown): void {
  console.info(`[SpotifyExport] ${message}`, details ?? '')
}

function logWarning(message: string, details?: unknown): void {
  console.warn(`[SpotifyExport] ${message}`, details ?? '')
}

function logError(message: string, details?: unknown): void {
  console.error(`[SpotifyExport] ${message}`, details ?? '')
}

// Regex for a properly formatted Spotify track URI.
const SPOTIFY_TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]+$/

// Resolve the Spotify URI to use when exporting a track.
// Prefers spotifyURI if available
// fall back to trackID, IF it's a valid Spotify track URI.
// Returns undefined for tracks that fail both checks, signifying Spotify incompatibility
export function resolveExportURI(track: Track): string | undefined {
  const uri = track.spotifyURI as string | undefined
  if (uri && SPOTIFY_TRACK_URI_RE.test(uri)) return uri
  if (SPOTIFY_TRACK_URI_RE.test(track.trackID)) return track.trackID
  return undefined
}

// Spotify export adapter: exports playlists and tracks to Spotify using the Web API. 
// Creates a new playlist for each exported playlist, and adds tracks in batches.
export const spotifyExportAdapter: ExportAdapter<SpotifyExportOptions> = {
  key: 'spotify',
  label: 'Spotify',

  // Main export function. Loops through playlists, creates Spotify playlist, and adds tracks in batches.
  async export(options: SpotifyExportOptions, onProgress?): Promise<ExportResult> {
    if (!spotifyAuth.getAccessToken()) {
      throw new Error('Not authenticated — no Spotify access token available')
    }

    const playlistIds = options.playlistIds
    const total = playlistIds.length
    let exported = 0
    const errors: string[] = []
    const createdPlaylists: Array<{ name: string; spotifyId: string }> = []

    logInfo('Starting Spotify export', { playlistCount: total, playlistIds })

    // Loop through given playlist IDs, fetch from DB, create Spotify playlist, and add tracks in batches. 
    // Progress is reported after each playlist is processed.
    for (let i = 0; i < playlistIds.length; i += 1) {
      const playlistId = playlistIds[i]!

      
      try {
        const playlist = await db.playlists.get(playlistId)
        if (!playlist) {
          const msg = `Playlist ${playlistId} not found in library`
          logWarning(msg)
          errors.push(msg)
          continue
        }

        // Fetch Spotify URIs for all tracks in the playlist, skipping any that are missing or not Spotify tracks.
        const tracks = await db.tracks.bulkGet(playlist.trackIDs)
        const spotifyUris = tracks
          .map((track) => (track ? resolveExportURI(track) : undefined))
          .filter((uri): uri is string => uri !== undefined)

        // If no tracks with Spotify URIs, skip creating the playlist and move to the next one. 
        // Log a warning and record an error for reporting.
        // TODO why are we skipping all?
        if (spotifyUris.length === 0) {
          const msg = `Skipped "${playlist.name}": no tracks with Spotify URIs`
          logWarning(msg, { playlistName: playlist.name, totalTracks: playlist.trackIDs.length })
          errors.push(msg)
          continue
        }

        // Log intent to create playlist, with stats about number of tracks to be added.
        logInfo('Creating Spotify playlist', {
          playlistName: playlist.name,
          exportableTracks: spotifyUris.length,
          skippedTracks: playlist.trackIDs.length - spotifyUris.length,
        })

        // Create the playlist on Spotify
        const created = await spotifyApi.post<SpotifyCreatePlaylistResponse>('/me/playlists', {
          // name: `${PREFIX_PLAYLIST_NAME}${playlist.name}`,
          name: PREFIX_PLAYLIST_NAME+playlist.name,
          public: false,
          description: PLAYLIST_DESCRIPTION,
        })

        // Add tracks to the playlist in batches, respecting Spotify's limits. NOTE: Leaning conservative for now with lower chunk size
        for (let c = 0; c < spotifyUris.length; c += CHUNK_SIZE) {
          const chunk = spotifyUris.slice(c, c + CHUNK_SIZE)
          await spotifyApi.post(`/playlists/${created.id}/items`, { uris: chunk })
        }

        // Push the created playlist info for reporting, and update progress. 
        // Log completion of this playlist export with stats.
        createdPlaylists.push({ name: playlist.name, spotifyId: created.id })
        exported += 1
        onProgress?.(exported, total, playlist.name)

        logInfo('Exported Spotify playlist', {
          playlistName: playlist.name,
          trackCount: spotifyUris.length,
          spotifyId: created.id,
        })
      } 
      // Catch and log any errors during playlist creation or track addition. 
      // If it's a 403 error, log a warning and continue with the next playlist. 
      // For other errors, log an error and re-throw to stop the export.
      catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Spotify export error'
        if (message.includes('403')) {
          const msg = `Skipped playlist ${playlistId}: permission denied`
          logWarning(msg, { playlistId, message })
          errors.push(msg)
          continue
        }
        logError('Spotify playlist export failed', { playlistId, message })
        throw err
      }

      if (i < playlistIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, SLEEP_BETWEEN_PLAYLISTS_MS))
      }
    }

    logInfo('Spotify export complete', { exported, total, errorCount: errors.length })

    return {
      playlistsExported: exported,
      errors,
      createdPlaylists,
    }
  },
}
