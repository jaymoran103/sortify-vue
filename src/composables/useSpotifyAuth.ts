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
let _fetchUserInFlight: Promise<void> | null = null

// Module-level helpers: operate on shared state, safe to call outside a component.
// Fetches the Spotify user profile from GET /me and updates the cached user ref.
// Uses an in-flight guard so concurrent callers (multiple onMounted hooks) collapse onto a single request instead of firing duplicates.
// TODO: review caching strategy, clearing more frequently or on certain triggers. 
async function fetchUser(): Promise<void> {
  if (_fetchUserInFlight) return _fetchUserInFlight
  _fetchUserInFlight = (async () => {
    try {
      const profile = await spotifyApi.get<SpotifyUserProfile>('/me')
      _cachedUser.value = profile
    } catch (err) {
      _error.value = err instanceof Error ? err.message : 'Failed to fetch user profile'
    } finally {
      _fetchUserInFlight = null
    }
  })()
  return _fetchUserInFlight
}

// Exported standalone callback handler: called from main.ts without a component context.
// Does not use onMounted or any other lifecycle hook.
export async function handleSpotifyCallback(): Promise<void> {
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
  // Initiates PKCE login flow — redirects to Spotify authorization page.
  async function login(): Promise<void> {
    _error.value = null
    await spotifyAuth.authenticate()
  }

  // Clears all stored auth data and resets local state.
  function logout(): void {
    spotifyAuth.clearAuth()
    _isAuthenticated.value = false
    _cachedUser.value = null
    _error.value = null
  }

  onMounted(() => {
    _isAuthenticated.value = spotifyAuth.isAuthenticated()
    if (_isAuthenticated.value && !_cachedUser.value) {
      fetchUser()
    }
  })

  return {
    isAuthenticated: _isAuthenticated,
    user: _cachedUser,
    isLoading: _isLoading,
    error: _error,
    login,
    logout,
    handleCallback: handleSpotifyCallback,
  }
}
