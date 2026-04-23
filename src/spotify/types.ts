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
// For local files, deleted tracks, and podcast episodes, the track field is null.
//
// Spotify playlist-items schema (GET /playlists/{id}/items) wraps each item in a PlaylistTrackObject whose `item` field is the media object.
export interface SpotifyTrackPayload {
  type: 'track'
  uri: string
  name: string
  album: { name: string }
  artists: Array<{ name: string }>
  duration_ms: number
  popularity?: number
  explicit: boolean
  is_playable?: boolean
}

// Spotify API shape for a podcast episode, which can appear in playlists but is not importable as a track. 
// FUTURE: These have a different schema from tracks, so we need to check the type field and handle accordingly if adding support for importing episodes
export interface SpotifyEpisodePayload {
  type: 'episode'
  uri: string
  name: string
  duration_ms?: number
}

// Current playlist-items shape: item IS the media object per the updated API spec
export interface SpotifyPlaylistTrackWrapper {
  added_at: string
  added_by: {
    external_urls: { spotify: string }
    href: string
    id: string
    type: string
    uri: string
  }
  is_local: boolean
  primary_color: string | null
  item: SpotifyTrackPayload | SpotifyEpisodePayload | null
  video_thumbnail: { url: string | null }
}

export type SpotifyTrackItem = SpotifyPlaylistTrackWrapper

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
