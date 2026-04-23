// Client ID for Spotify API. This is a public key, safe to include in client-side code
export const SPOTIFY_CLIENT_ID = '95ba1274418d436a8540ebee2d22c8ed'

// Redirect URI: Use env var if set, otherwise fall back to the fixed app base path.
export const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI ?? window.location.origin + '/sortify-vue/'

// Permitted Scopes for API access
export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
].join(' ')

// Rate-limit safety
export const SLEEP_BETWEEN_REQUESTS_MS = 300
export const SLEEP_BETWEEN_PLAYLISTS_MS = 1000
export const MAX_RETRIES = 3
export const FALLBACK_RETRY_AFTER_MS = 30_000

// When true, a single 429 response aborts all pending API work immediately.
// will set to false once rate-throttling mechanisms are fully trusted and tested
// Should be fine but want to avoid issue from vanilla POC

export const ABORT_ON_FIRST_429 = true
