import { ref, onMounted } from 'vue'
import type { Ref } from 'vue'
import { spotifyAuth } from '@/spotify/auth'
import { spotifyApi } from '@/spotify/api'
import type { SpotifyUserProfile } from '@/spotify/types'

// Module-level reactive state: shared across all composable consumers.
const _cachedUser = ref<SpotifyUserProfile | null>(null)
const _isAuthenticated = ref(spotifyAuth.isAuthenticated())
const _isLoading = ref(false)
const _error = ref<string | null>(null)

// Returns reactive auth state and actions for use in components.
// All consumers share the same underlying state, so updates propagate immediately.
export function useSpotifyAuth(): {
  isAuthenticated: Ref<boolean>
  user: Ref<SpotifyUserProfile | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  login: () => Promise<void>
  logout: () => void
  handleCallback: () => Promise<void>
} {
  const isAuthenticated = _isAuthenticated
  const user = _cachedUser
  const isLoading = _isLoading
  const error = _error

  // Fetches the Spotify user profile from GET /me and updates the cached user ref.
  async function fetchUser(): Promise<void> {
    try {
      const profile = await spotifyApi.get<SpotifyUserProfile>('/me')
      _cachedUser.value = profile
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch user profile'
    }
  }

  // Initiates PKCE login flow — redirects to Spotify authorization page.
  async function login(): Promise<void> {
    await spotifyAuth.authenticate()
  }

  // Clears all stored auth data and resets local state.
  function logout(): void {
    spotifyAuth.clearAuth()
    _isAuthenticated.value = false
    _cachedUser.value = null
    _error.value = null
  }

  // Called on app startup when ?code= is present in the URL.
  // Exchanges the authorization code for a token, then fetches the user profile.
  async function handleCallback(): Promise<void> {
    _isLoading.value = true
    _error.value = null
    try {
      await spotifyAuth.handleCallback()
      _isAuthenticated.value = true
      await fetchUser()
    } catch (err) {
      _error.value = err instanceof Error ? err.message : 'Auth callback failed'
      _isAuthenticated.value = false
    } finally {
      _isLoading.value = false
    }
  }

  onMounted(() => {
    _isAuthenticated.value = spotifyAuth.isAuthenticated()
    if (_isAuthenticated.value && !_cachedUser.value) {
      fetchUser()
    }
  })

  return { isAuthenticated, user, isLoading, error, login, logout, handleCallback }
}
