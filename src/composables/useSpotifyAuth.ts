import { ref, onMounted } from 'vue'
import type { Ref } from 'vue'
import { spotifyAuth } from '@/spotify/auth'
import { spotifyApi } from '@/spotify/api'
import type { SpotifyUserProfile } from '@/spotify/types'

// Module-level cache: persists across component mounts within the same session.
const _cachedUser = ref<SpotifyUserProfile | null>(null)

// Returns reactive auth state and actions for use in components.
// isAuthenticated is re-checked on mount and after callback.
// user is fetched from GET /me after successful auth and cached at module level.
export function useSpotifyAuth(): {
  isAuthenticated: Ref<boolean>
  user: Ref<SpotifyUserProfile | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  login: () => Promise<void>
  logout: () => void
  handleCallback: () => Promise<void>
} {
  const isAuthenticated = ref(spotifyAuth.isAuthenticated())
  const user = _cachedUser
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
    isAuthenticated.value = false
    _cachedUser.value = null
    error.value = null
  }

  // Called on app startup when ?code= is present in the URL.
  // Exchanges the authorization code for a token, then fetches the user profile.
  async function handleCallback(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await spotifyAuth.handleCallback()
      isAuthenticated.value = true
      await fetchUser()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Auth callback failed'
      isAuthenticated.value = false
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    isAuthenticated.value = spotifyAuth.isAuthenticated()
    // If already authenticated and no user cached, fetch the profile
    if (isAuthenticated.value && !_cachedUser.value) {
      fetchUser()
    }
  })

  return { isAuthenticated, user, isLoading, error, login, logout, handleCallback }
}
