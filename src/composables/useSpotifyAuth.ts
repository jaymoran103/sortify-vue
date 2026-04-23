import { ref, onMounted } from 'vue'
import type { Ref } from 'vue'
import { spotifyAuth } from '@/spotify/auth'
import { spotifyApi } from '@/spotify/api'
import type { SpotifyUserProfile } from '@/spotify/types'
import { savePendingIntent, PENDING_ACTIONS } from '@/spotify/pendingIntent'

// Module-level reactive state: shared across all composable consumers.
const _cachedUser = ref<SpotifyUserProfile | null>(null)
const _isAuthenticated = ref(spotifyAuth.isAuthenticated())
const _isLoading = ref(false)
const _error = ref<string | null>(null)
// Set after OAuth callback completes; consumed by IOCard to re-open the intended action.
const _pendingAction = ref<string | null>(null)
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

// Exported standalone setter: called from main.ts after consuming the pending intent.
// Follows the same module-level pattern as handleSpotifyCallback — safe to call outside a component context.
export function setPendingAction(action: string): void {
  _pendingAction.value = action
}

// Returns reactive auth state and actions for use in components.
// All consumers share the same underlying state, so updates propagate immediately.
export function useSpotifyAuth(): {
  isAuthenticated: Ref<boolean>
  user: Ref<SpotifyUserProfile | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  pendingAction: Ref<string | null>
  login: (pendingAction?: string) => Promise<void>
  logout: () => void
  clearPendingAction: () => void
  handleCallback: () => Promise<void>
} {
  // Initiates PKCE login flow — saves pending intent then redirects to Spotify authorization page.
  // pendingAction defaults to CONNECT_ONLY so the IOCard connect button never leaves a stale pending action.
  async function login(pendingAction: string = PENDING_ACTIONS.CONNECT_ONLY): Promise<void> {
    _error.value = null
    // Strip the leading '#' — router.push() with createWebHashHistory() expects '/path', not '#/path'.
    // window.location.hash is '#/dashboard'; we store '/dashboard' so router.push(returnRoute) works.
    // FUTURE: Review and ensure this works in all cases where login() can be called
    savePendingIntent({ action: pendingAction, returnRoute: window.location.hash.slice(1) || '/' })
    await spotifyAuth.authenticate()
  }

  // Clears all stored auth data and resets local state.
  function logout(): void {
    spotifyAuth.clearAuth()
    _isAuthenticated.value = false
    _cachedUser.value = null
    _error.value = null
  }

  // Consumes the pending action after IOCard has acted on it so it cannot fire again on re-mount.
  function clearPendingAction(): void {
    _pendingAction.value = null
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
    pendingAction: _pendingAction,
    login,
    logout,
    clearPendingAction,
    handleCallback: handleSpotifyCallback,
  }
}
