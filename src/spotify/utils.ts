// Normalizes a Spotify API 'next' URL or path into an endpoint string for spotifyApi.get().
// Handles both full HTTPS URLs (strips base URL and /v1/ prefix) and relative paths.
export function normalizeSpotifyEndpoint(next: string): string {
  if (next.startsWith('http')) {
    const url = new URL(next)
    const path = `${url.pathname}${url.search}`
    return path.startsWith('/v1/') ? path.slice(3) : path
  }
  return next.startsWith('/v1/') ? next.slice(3) : next
}
