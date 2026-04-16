import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'

// Stub spotifyAuth and spotifyApi at the module level
vi.mock('@/spotify/auth', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn().mockReturnValue(false),
    authenticate: vi.fn().mockResolvedValue(undefined),
    handleCallback: vi.fn().mockResolvedValue('mock-token'),
    clearAuth: vi.fn(),
    getAccessToken: vi.fn().mockReturnValue(null),
  },
}))

vi.mock('@/spotify/api', () => ({
  spotifyApi: {
    get: vi.fn().mockResolvedValue({
      id: 'user1',
      display_name: 'Test User',
      images: [],
    }),
  },
}))

// Helper to test composable in a component
function useInComponent() {
  let result: ReturnType<typeof useSpotifyAuth> | undefined
  const Wrapper = defineComponent({
    setup() {
      result = useSpotifyAuth()
      return result
    },
    template: '<div />',
  })
  mount(Wrapper)
  return result!
}

describe('useSpotifyAuth', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('returns isAuthenticated as false when not authenticated', () => {
    const { isAuthenticated } = useInComponent()
    expect(isAuthenticated.value).toBe(false)
  })

  it('login() calls spotifyAuth.authenticate()', async () => {
    const { spotifyAuth } = await import('@/spotify/auth')
    const { login } = useInComponent()
    await login()
    expect(spotifyAuth.authenticate).toHaveBeenCalled()
  })

  it('logout() calls spotifyAuth.clearAuth() and resets state', async () => {
    const { spotifyAuth } = await import('@/spotify/auth')
    ;(spotifyAuth.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(true)
    const { logout, isAuthenticated, user } = useInComponent()
    logout()
    expect(spotifyAuth.clearAuth).toHaveBeenCalled()
    expect(isAuthenticated.value).toBe(false)
    expect(user.value).toBeNull()
  })

  it('handleCallback() exchanges code and fetches user on success', async () => {
    const { spotifyAuth } = await import('@/spotify/auth')
    const { spotifyApi } = await import('@/spotify/api')

    const { handleCallback, isAuthenticated, user, isLoading } = useInComponent()

    const cbPromise = handleCallback()
    expect(isLoading.value).toBe(true)
    await flushPromises()
    await cbPromise

    expect(spotifyAuth.handleCallback).toHaveBeenCalled()
    expect(spotifyApi.get).toHaveBeenCalledWith('/me')
    expect(isAuthenticated.value).toBe(true)
    expect(user.value?.display_name).toBe('Test User')
    expect(isLoading.value).toBe(false)
  })

  it('handleCallback() sets error on failure', async () => {
    const { spotifyAuth } = await import('@/spotify/auth')
    ;(spotifyAuth.handleCallback as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('state mismatch'),
    )

    const { handleCallback, error, isAuthenticated } = useInComponent()
    await handleCallback()
    await flushPromises()

    expect(error.value).toContain('state mismatch')
    expect(isAuthenticated.value).toBe(false)
  })

  it('returns isLoading ref', () => {
    const { isLoading } = useInComponent()
    expect(isLoading.value).toBe(false)
  })
})
