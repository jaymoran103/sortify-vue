// Spotify API response shapes. These are Spotify-side types only.
// Adapters map these to the app's Track/Playlist models.

// Summary info for a playlist, from GET /me/playlists or similar.
export interface SpotifyPlaylistSummary {
  id: string
  name: string
  tracks: { total: number }
  owner: { display_name: string }
  images: Array<{ url: string }>
}

// Detailed track info from Spotify API, including nested album and artist data.
// For local files, deleted tracks, and podcast episodes, the track field is null
// TODO ensure proper handling, likely skipping and flagging was warnings for import result display
export interface SpotifyTrackItem {
  track: {
    uri: string
    name: string
    album: { name: string }
    artists: Array<{ name: string }>
    duration_ms: number
    popularity: number
    explicit: boolean
  } | null // null for local files, deleted tracks, podcast episodes
}

// Response shape for Spotify API endpoints that return paginated lists of tracks, 
// e.g. GET /playlists/{id}/tracks
export interface SpotifyPaginatedResponse<T> {
  items: T[]
  total: number
  next: string | null
  offset: number
  limit: number
}

// User profile info from GET /me, used for displaying user name. 
// FUTURE: may expand to display profile image and other info in the app, currently just using display_name.
export interface SpotifyUserProfile {
  id: string
  display_name: string | null
  images: Array<{ url: string }>
}
