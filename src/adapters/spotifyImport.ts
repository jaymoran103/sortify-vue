import { db } from '@/db'
import type { Track } from '@/types/models'
import type { ImportAdapter, ImportResult } from '@/types/adapters'
import type { SpotifyPlaylistSummary, SpotifyPaginatedResponse, SpotifyTrackItem } from '@/spotify/types'
import { spotifyAuth } from '@/spotify/auth'
import { spotifyApi } from '@/spotify/api'
import { SLEEP_BETWEEN_PLAYLISTS_MS } from '@/spotify/config'

export interface SpotifyImportOptions {
  playlists: SpotifyPlaylistSummary[]
}

type SpotifyTrack = NonNullable<SpotifyTrackItem['track']>

function hasEpisode(item: SpotifyTrackItem): boolean {
  return 'episode' in item && item.episode !== null && item.episode !== undefined
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

// Normalize a spotify track into the internal Track format, extracting relevant fields and flattening artists.
// FUTURE: Make a note somewhere about artist tracking, storing IDs rather than string names. As artist info is currently display-only, seems better to leave as flattened string for now.
function normalizeSpotifyTrack(item: SpotifyTrack): Track {
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

// transforms Spotify's paginated "next" URLs into API endpoints.
// Spotify's API may return either full URLs or just paths, and the paths may or may not start with /v1/. 
// This function normalizes them into consistent API endpoints that can be passed to spotifyApi.get().
function getSpotifyEndpoint(next: string): string {
  if (next.startsWith('http')) {
    const url = new URL(next)
    const path = `${url.pathname}${url.search}`
    return path.startsWith('/v1/') ? path.slice(3) : path
  }
  return next.startsWith('/v1/') ? next.slice(3) : next
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
    logInfo('Starting Spotify import', { playlistCount: options.playlists.length })

    let totalTracks = options.playlists.reduce(
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
      
      // Paginate through this playlist's tracks, normalizing and writing each to the DB if not already present.
      const expectedTracks = playlist.tracks?.total ?? 0
      let resolvedTracks = expectedTracks
      let resolvedTrackCount = false
      logInfo('Importing Playlist', {
        playlistId: playlist.id,
        playlistName: playlist.name,
        expectedTracks,
      })
      try {
        while (endpoint) {
          logInfo('Fetching Spotify tracks page', { endpoint, playlistName: playlist.name })
          const page = await spotifyApi.get<SpotifyPaginatedResponse<SpotifyTrackItem>>(endpoint)

          // Log the raw shape of the first item on the first page to diagnose response mismatches.
          if (!resolvedTrackCount && page.items.length > 0) {
            const firstItem = page.items[0]
            logInfo('Raw first track item structure', {
              playlistName: playlist.name,
              keys: Object.keys(firstItem as object),
              hasTrackField: 'track' in (firstItem as object),
              trackIsNull: (firstItem as SpotifyTrackItem).track === null,
              hasEpisodeField: 'episode' in (firstItem as object),
            })
          }

          if (!resolvedTrackCount) {
            resolvedTrackCount = true
            resolvedTracks = page.total
            if (resolvedTracks !== expectedTracks) {
              totalTracks += resolvedTracks - expectedTracks
              logInfo('Resolved Spotify playlist track total from API page metadata', {
                playlistName: playlist.name,
                expectedTracks,
                resolvedTracks,
              })
            }
          }
          let skippedNullTracks = 0
          let skippedEpisodes = 0
          let realTracksThisPage = 0

          for (const item of page.items) {
            if (!item.track) {
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
            const normalized = normalizeSpotifyTrack(item.track)
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

          // Warn explicitly if the entire page had no importable tracks. helps diagnose API shape issues.
          if (page.items.length > 0 && realTracksThisPage === 0) {
            const sampleItem = page.items[0] as unknown as Record<string, unknown>
            logWarning('No importable tracks on this page — all items had null track field', {
              playlistName: playlist.name,
              pageSize: page.items.length,
              skippedEpisodes,
              skippedUnknownItems: skippedNullTracks - skippedEpisodes,
              sampleItemKeys: Object.keys(sampleItem),
              sampleItemTrackType: typeof sampleItem['track'],
              sampleItemEpisode: sampleItem['episode'] ?? 'absent',
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
            resolvedTracks,
          })

          onProgress?.(processedTracks, totalTracks, playlist.name)
          endpoint = page.next ? getSpotifyEndpoint(page.next) : ''
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
