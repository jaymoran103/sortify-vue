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
    return `${url.pathname}${url.search}`
  }
  return next
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

    const totalTracks = options.playlists.reduce(
      (sum, playlist) => sum + (playlist.tracks?.total ?? 0),
      0,
    )
    let processedTracks = 0
    let importedTracks = 0
    let importedPlaylists = 0
    const errors: string[] = []

    for (let playlistIndex = 0; playlistIndex < options.playlists.length; playlistIndex += 1) {
      const playlist = options.playlists[playlistIndex]!
      const playlistTrackIds: string[] = []
      let endpoint = `/playlists/${playlist.id}/items?limit=50`
      
      // Paginate through this playlist's tracks, normalizing and writing each to the DB if not already present.
      try {
        while (endpoint) {
          const page = await spotifyApi.get<SpotifyPaginatedResponse<SpotifyTrackItem>>(endpoint)

          for (const item of page.items) {
            if (!item.track) {
              processedTracks += 1
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
          }

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
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Spotify playlist import error'
        if (message.includes('403')) {
          console.warn(`Spotify playlist skipped due to permissions: ${playlist.name}`)
          errors.push(`Skipped playlist ${playlist.name}: permission denied`)
          continue
        }
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
