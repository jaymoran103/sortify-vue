import type { SpotifyAuth } from './auth'
import { spotifyAuth } from './auth'
import {
  SLEEP_BETWEEN_REQUESTS_MS,
  MAX_RETRIES,
  FALLBACK_RETRY_AFTER_MS,
  ABORT_ON_FIRST_429,
} from './config'
const BASE_URL = 'https://api.spotify.com/v1'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class SpotifyApi {
  private auth: SpotifyAuth
  private _lastRequestTime = 0

  constructor(auth: SpotifyAuth) {
    this.auth = auth
  }

  // Waits if needed to maintain minimum spacing between requests.
  // Uses slot reservation: _lastRequestTime is updated synchronously before yielding, so concurrent callers each claim 
  // successive time slots instead of all reading the same stale timestamp and firing simultaneously.
  // NOTE: This is key for avoiding triggering rate limits, ensuring reliable request spacing even under use by concurrent components.
  private async _throttle(): Promise<void> {
    const now = Date.now()
    const nextSlot = this._lastRequestTime + SLEEP_BETWEEN_REQUESTS_MS
    const wait = Math.max(0, nextSlot - now)
    this._lastRequestTime = Math.max(now, nextSlot)
    if (wait > 0) await sleep(wait)
  }

  // Sends a GET request to the given Spotify API endpoint.
  // Handles rate limiting and retries up to MAX_RETRIES times unless ABORT_ON_FIRST_429.
  // onRateLimit is called with the wait duration in seconds before each retry wait.
  async get<T>(endpoint: string, onRateLimit?: (seconds: number) => void): Promise<T> {
    return this._request<T>('GET', endpoint, undefined, onRateLimit)
  }

  // Sends a POST request to the given Spotify API endpoint with the provided body.
  async post<T>(
    endpoint: string,
    body: unknown,
    onRateLimit?: (seconds: number) => void,
  ): Promise<T> {
    return this._request<T>('POST', endpoint, body, onRateLimit)
  }

  // Internal method that executes the HTTP request with rate-limit handling.
  private async _request<T>(
    method: string,
    endpoint: string,
    body: unknown,
    onRateLimit?: (seconds: number) => void,
  ): Promise<T> {
    // Fail fast if not currently authenticated
    if (!this.auth.getAccessToken()) {
      throw new Error('Not authenticated — no access token available')
    }

    let attempts = 0
    const maxAttempts = ABORT_ON_FIRST_429 ? 1 : MAX_RETRIES + 1

    // Until a successful response or max retries hit, attempt the request and handle 429 rate limits.
    while (attempts < maxAttempts) {
      
      // Re-check token each iteration: a long Retry-After sleep may have expired the token.
      const token = this.auth.getAccessToken()
      if (!token) {
        throw new Error('Not authenticated — token expired during retry wait')
      }

      await this._throttle()

      // Execute the HTTP request
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,

          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      // Handle rate limiting (HTTP 429)
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After')
        const retryAfterMs = retryAfterHeader
          ? parseInt(retryAfterHeader, 10) * 1000
          : FALLBACK_RETRY_AFTER_MS
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)

        // NOTE: Development safety mechanism — abort all retries immediately on 429 until approach is fully trusted and tested. 
        //       Should be fine but want to avoid issue from vanilla POC
        if (ABORT_ON_FIRST_429) {
          throw new Error(
            `Rate limited by Spotify on ${endpoint}. Retry after ${retryAfterSeconds}s. Aborting.`,
          )
        }

        // Otherwise, wait and retry until max attempts reached.
        if (++attempts >= maxAttempts) {
          throw new Error(
            `Rate limited by Spotify on ${endpoint} and max retries (${MAX_RETRIES}) exceeded.`,
          )
        }

        // Call the onRateLimit callback with the retry duration in seconds, if provided.
        onRateLimit?.(retryAfterSeconds)
        await sleep(retryAfterMs)
        continue
      }

      // For non-429/rate errors, throw with status and endpoint info for easier debugging.
      if (!response.ok) {
        throw new Error(`Spotify API error ${response.status} on ${endpoint}`)
      }

      return response.json() as Promise<T>
    }

    // Should never reach here, ensures safe loop exit and type correctness.
    throw new Error(`Unexpected state in SpotifyApi._request for ${endpoint}`)
  }
}

// Singleton API client: import spotifyAuth first to avoid circular initialization issues.
export const spotifyApi = new SpotifyApi(spotifyAuth)
