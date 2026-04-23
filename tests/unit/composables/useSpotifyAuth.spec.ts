import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useSpotifyAuth, setPendingAction } from '@/composables/useSpotifyAuth'

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

vi.mock('@/spotify/pendingIntent', () => ({
  savePendingIntent: vi.fn(),
  consumePendingIntent: vi.fn().mockReturnValue(null),
  PENDING_ACTIONS: {
    OPEN_SPOTIFY_PICKER: 'open-spotify-picker',
    CONNECT_ONLY: 'connect-only',
  },
}))

// jsdom's localStorage.clear() is not implemented; stub it manually
const localStorageData: Record<string, string> = {}
const localStorageMock: Storage = {
  getItem: (key) => localStorageData[key] ?? null,
  setItem: (key, value) => { localStorageData[key] = String(value) },
  removeItem: (key) => { delete localStorageData[key] },
  clear: () => { for (const key in localStorageData) delete localStorageData[key] },
  key: (index) => Object.keys(localStorageData)[index] ?? null,
  get length() { return Object.keys(localStorageData).length },
}

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
    vi.stubGlobal('localStorage', localStorageMock)
    localStorageMock.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    // Reset module-level pendingAction between tests
    setPendingAction(null as unknown as string)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

  it('login() with no argument saves connect-only pending intent', async () => {
    const { savePendingIntent } = await import('@/spotify/pendingIntent')
    const { login } = useInComponent()
    await login()
    expect(savePendingIntent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'connect-only' }),
    )
  })

  it('login("open-spotify-picker") saves open-spotify-picker pending intent', async () => {
    const { savePendingIntent } = await import('@/spotify/pendingIntent')
    const { login } = useInComponent()
    await login('open-spotify-picker')
    expect(savePendingIntent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'open-spotify-picker' }),
    )
  })

  it('login() saves the hash path (without leading #) as returnRoute', async () => {
    const { savePendingIntent } = await import('@/spotify/pendingIntent')
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hash: '#/dashboard' },
      writable: true,
    })
    const { login } = useInComponent()
    await login('connect-only')
    expect(savePendingIntent).toHaveBeenCalledWith(
      expect.objectContaining({ returnRoute: '/dashboard' }),
    )
  })

  it('pendingAction is initially null', () => {
    const { pendingAction } = useInComponent()
    expect(pendingAction.value).toBeNull()
  })

  it('clearPendingAction() sets pendingAction to null', () => {
    setPendingAction('open-spotify-picker')
    const { pendingAction, clearPendingAction } = useInComponent()
    expect(pendingAction.value).toBe('open-spotify-picker')
    clearPendingAction()
    expect(pendingAction.value).toBeNull()
  })

  it('setPendingAction() (standalone export) sets the module-level pendingAction ref', () => {
    setPendingAction('open-spotify-picker')
    const { pendingAction } = useInComponent()
    expect(pendingAction.value).toBe('open-spotify-picker')
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
