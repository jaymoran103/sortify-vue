import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from './config'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'

const STORAGE_KEY_TOKEN = 'spotify_access_token'
const STORAGE_KEY_EXPIRY = 'spotify_token_expiry'
const STORAGE_KEY_VERIFIER = 'spotify_code_verifier'
const STORAGE_KEY_STATE = 'spotify_auth_state'

// Generates a short random string suitable for use as an OAuth state parameter.
function generateState(): string {
  const values = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(values, (b) => b.toString(16).padStart(2, '0')).join('')
}

export class SpotifyAuth {
  // Returns true when a non-expired access token is present in sessionStorage.
  isAuthenticated(): boolean {
    const token = sessionStorage.getItem(STORAGE_KEY_TOKEN)
    const expiry = sessionStorage.getItem(STORAGE_KEY_EXPIRY)
    if (!token || !expiry) return false
    return Date.now() < parseInt(expiry, 10)
  }

  // Generates PKCE verifier + challenge, stores verifier in localStorage (survives redirect),
  // stores state in sessionStorage, then redirects to Spotify's authorization endpoint.
  async authenticate(): Promise<void> {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    const state = generateState()

    // localStorage survives the redirect; sessionStorage does not in all browsers
    localStorage.setItem(STORAGE_KEY_VERIFIER, verifier)
    sessionStorage.setItem(STORAGE_KEY_STATE, state)

    const authUrl = new URL('https://accounts.spotify.com/authorize')
    authUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state,
    }).toString()

    window.location.href = authUrl.toString()
  }

  // Reads ?code and ?state from window.location.search, verifies state (CSRF protection),
  // exchanges the code for an access token via POST, stores the token, and cleans the URL.
  // Returns the access token string on success; throws on any validation or network failure.
  async handleCallback(): Promise<string> {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const returnedState = params.get('state')
    const error = params.get('error')

    if (error) {
      throw new Error(`Spotify auth denied: ${error}`)
    }
    if (!code) {
      throw new Error('No authorization code in callback URL')
    }

    const storedState = sessionStorage.getItem(STORAGE_KEY_STATE)
    if (!storedState || returnedState !== storedState) {
      throw new Error('OAuth state mismatch — possible CSRF attack')
    }

    const verifier = localStorage.getItem(STORAGE_KEY_VERIFIER)
    if (!verifier) {
      throw new Error('No code verifier found — cannot exchange token')
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        code_verifier: verifier,
      }).toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Token exchange failed (${response.status}): ${text}`)
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }

    const expiresAt = Date.now() + data.expires_in * 1000
    sessionStorage.setItem(STORAGE_KEY_TOKEN, data.access_token)
    sessionStorage.setItem(STORAGE_KEY_EXPIRY, String(expiresAt))

    // Clean up temp storage
    localStorage.removeItem(STORAGE_KEY_VERIFIER)
    sessionStorage.removeItem(STORAGE_KEY_STATE)

    // Remove ?code and ?state from the URL without triggering navigation
    history.replaceState({}, '', window.location.pathname + window.location.hash)

    return data.access_token
  }

  // Returns the access token if authenticated, null otherwise.
  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null
    return sessionStorage.getItem(STORAGE_KEY_TOKEN)
  }

  // Removes all Spotify auth data from sessionStorage and localStorage.
  clearAuth(): void {
    sessionStorage.removeItem(STORAGE_KEY_TOKEN)
    sessionStorage.removeItem(STORAGE_KEY_EXPIRY)
    sessionStorage.removeItem(STORAGE_KEY_STATE)
    localStorage.removeItem(STORAGE_KEY_VERIFIER)
  }
}

export const spotifyAuth = new SpotifyAuth()
