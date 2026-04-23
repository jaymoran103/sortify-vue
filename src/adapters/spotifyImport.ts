import { db } from '@/db'
import type { Track } from '@/types/models'
import type { ImportAdapter, ImportResult } from '@/types/adapters'
import type { SpotifyPlaylistSummary, SpotifyPaginatedResponse, SpotifyTrackItem, SpotifyTrackPayload } from '@/spotify/types'
import { spotifyAuth } from '@/spotify/auth'
import { spotifyApi } from '@/spotify/api'
import { SLEEP_BETWEEN_PLAYLISTS_MS } from '@/spotify/config'
import { normalizeSpotifyEndpoint } from '@/spotify/utils'

export interface SpotifyImportOptions {
  playlists: SpotifyPlaylistSummary[]
}

function getSpotifyTrack(item: SpotifyTrackItem): SpotifyTrackPayload | null {
  return item.item?.type === 'track' ? (item.item as SpotifyTrackPayload) : null
}

function hasEpisode(item: SpotifyTrackItem): boolean {
  return item.item?.type === 'episode'
}

function logInfo(message: string, details?: unknown): void {
  console.info(`[SpotifyImport] ${message}`, details ?? '')
}

function logWarning(message: string, details?: unknown): void {
  console.warn(`[SpotifyImport] ${message}`, details ?? '')
}

function logError(message: string, details?: unknown): void {
  console.error(`[SpotifyImport] ${message}`, details ?? '')
}

// Normalize a spotify track payload into the internal Track format, extracting relevant fields and flattening artists.
// FUTURE: Make a note somewhere about artist tracking, storing IDs rather than string names. As artist info is currently display-only, seems better to leave as flattened string for now.
function normalizeSpotifyTrack(item: SpotifyTrackPayload): Track {
  return {
    trackID: item.uri,
    title: item.name,
    artist: item.artists.map((a) => a.name).join(', '),
    album: item.album.name,
    source: 'spotify',
    spotifyURI: item.uri,
    duration: item.duration_ms,
  }
}


// Spotify import adapter: imports playlists and tracks from Spotify using the Web API.
export const spotifyImportAdapter: ImportAdapter<SpotifyImportOptions> = {
  key: 'spotify',
  label: 'Spotify',

  // Main import function. Loops through playlists, paginating through tracks, and writes to the DB.
  async import(options: SpotifyImportOptions, onProgress?): Promise<ImportResult> {
    if (!spotifyAuth.getAccessToken()) {
      throw new Error('Not authenticated - no access token available')
    }

    // Log intent to import, with basic stats about the import size
    logInfo('Starting Spotify import', {
      playlistCount: options.playlists.length,
      playlistSummaries: options.playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        tracksTotal: playlist.tracks?.total ?? 0,
      })),
    })

    const totalTracks = options.playlists.reduce(
      (sum, playlist) => sum + (playlist.tracks?.total ?? 0),
      0,
    )
    let processedTracks = 0
    let importedTracks = 0
    let importedPlaylists = 0
    const errors: string[] = []

    // Loop through each playlist and import tracks
    for (let playlistIndex = 0; playlistIndex < options.playlists.length; playlistIndex += 1) {
      const playlist = options.playlists[playlistIndex]!
      const playlistTrackIds: string[] = []
      let endpoint = `/playlists/${playlist.id}/items?limit=50`
      
      logInfo('Importing Playlist', {
        playlistId: playlist.id,
        playlistName: playlist.name,
        expectedTracks: playlist.tracks?.total ?? 0,
      })
      try {
        while (endpoint) {
          logInfo('Fetching Spotify tracks page', { endpoint, playlistName: playlist.name })
          const page = await spotifyApi.get<SpotifyPaginatedResponse<SpotifyTrackItem>>(endpoint)

          let skippedNullTracks = 0
          let skippedEpisodes = 0
          let realTracksThisPage = 0

          for (const item of page.items) {
            const track = getSpotifyTrack(item)
            if (!track) {
              processedTracks += 1
              skippedNullTracks += 1
              if (hasEpisode(item)) {
                skippedEpisodes += 1
              }
              continue
            }

            // Normalize track, checking if it already exists in the DB by trackID.
            // Add if not yet present.
            // FUTURE: Worth it to fully normalize first, rather than just determining trackID and checking presence in DB?
            const normalized = normalizeSpotifyTrack(track)
            const existing = await db.tracks.get(normalized.trackID)
            if (!existing) {
              await db.tracks.put(normalized)
            }
            playlistTrackIds.push(normalized.trackID)
            processedTracks += 1
            importedTracks += 1
            realTracksThisPage += 1
          }

          // Log any skipped tracks, with reason.
          if (skippedNullTracks > 0) {
            logWarning('Skipped Spotify playlist items with null tracks', {
              playlistName: playlist.name,
              skippedNullTracks,
              skippedEpisodes,
              skippedUnknownItems: skippedNullTracks - skippedEpisodes,
            })
          }

          // Warn if the entire page had no importable tracks. May indicate an API schema issue.
          if (page.items.length > 0 && realTracksThisPage === 0) {
            logWarning('No importable tracks on this page — all items were null or were episodes', {
              playlistName: playlist.name,
              pageSize: page.items.length,
              skippedEpisodes,
              skippedUnknownItems: skippedNullTracks - skippedEpisodes,
            })
          }

          // Log progress after each page.
          logInfo('Processed Spotify playlist page', {
            playlistName: playlist.name,
            pageSize: page.items.length,
            realTracksThisPage,
            skippedNullTracks,
            processedTracks,
            totalTracks,
          })

          onProgress?.(processedTracks, totalTracks, playlist.name)
          endpoint = page.next ? normalizeSpotifyEndpoint(page.next) : ''
        }

        // After processing all tracks in this playlist, add the playlist to the DB with its trackIDs.
        await db.playlists.add({
          name: playlist.name,
          trackIDs: playlistTrackIds,
          playlistURI: `spotify:playlist:${playlist.id}`,
          timeAdded: Date.now(),
          lastModified: Date.now(),
        })
        importedPlaylists += 1
        // Log the completion of this playlist's import, with stats about how many tracks were imported.
        logInfo('Finished Spotify playlist import', {
          playlistName: playlist.name,
          playlistTrackCount: playlistTrackIds.length,
        })
      } catch (err) {

        // Log caught errors and continue with the next playlist. 
        // Common errors will be caught here and explained concisely for the user.
        const message = err instanceof Error ? err.message : 'Unknown Spotify playlist import error'
        if (message.includes('403')) {
          logWarning('Spotify playlist skipped due to permissions', {
            playlistName: playlist.name,
            playlistId: playlist.id,
          })
          errors.push(`Skipped playlist ${playlist.name}: permission denied`)
          continue
        }
        logError('Spotify playlist import failed', {
          playlistName: playlist.name,
          playlistId: playlist.id,
          message,
        })
        throw err
      }

      if (playlistIndex < options.playlists.length - 1) {
        // Give Spotify a short pause between playlists to be polite and avoid rate-limits.
        await new Promise((resolve) => setTimeout(resolve, SLEEP_BETWEEN_PLAYLISTS_MS))
      }
    }

    return {
      tracksImported: importedTracks,
      playlistsImported: importedPlaylists,
      errors,
    }
  },
}
