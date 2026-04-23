import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SpotifyAuth } from '@/spotify/auth'

const localStorageData: Record<string, string> = {}
const localStorageMock: Storage = {
  getItem(key: string) {
    const value = localStorageData[key]
    return value === undefined ? null : value
  },
  setItem(key: string, value: string) {
    localStorageData[key] = String(value)
  },
  removeItem(key: string) {
    delete localStorageData[key]
  },
  clear() {
    for (const key in localStorageData) {
      delete localStorageData[key]
    }
  },
  key(index: number): string | null {
    const keys = Object.keys(localStorageData)
    return keys[index] ?? null
  },
  get length() {
    return Object.keys(localStorageData).length
  },
}

describe('SpotifyAuth', () => {
  let auth: SpotifyAuth

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock)
    localStorageMock.clear()
    sessionStorage.clear()
    auth = new SpotifyAuth()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // isAuthenticated
  describe('isAuthenticated()', () => {
    it('returns false when no token is stored', () => {
      expect(auth.isAuthenticated()).toBe(false)
    })

    it('returns false when token is expired', () => {
      sessionStorage.setItem('spotify_access_token', 'tok')
      sessionStorage.setItem('spotify_token_expiry', String(Date.now() - 1000))
      expect(auth.isAuthenticated()).toBe(false)
    })

    it('returns true when token exists and is not expired', () => {
      sessionStorage.setItem('spotify_access_token', 'tok')
      sessionStorage.setItem('spotify_token_expiry', String(Date.now() + 60_000))
      expect(auth.isAuthenticated()).toBe(true)
    })
  })

  // getAccessToken
  describe('getAccessToken()', () => {
    it('returns null when not authenticated', () => {
      expect(auth.getAccessToken()).toBeNull()
    })

    it('returns the token when authenticated', () => {
      sessionStorage.setItem('spotify_access_token', 'mytoken')
      sessionStorage.setItem('spotify_token_expiry', String(Date.now() + 60_000))
      expect(auth.getAccessToken()).toBe('mytoken')
    })
  })

  // clearAuth
  describe('clearAuth()', () => {
    it('removes all stored auth data', () => {
      sessionStorage.setItem('spotify_access_token', 'tok')
      sessionStorage.setItem('spotify_token_expiry', String(Date.now() + 60_000))
      sessionStorage.setItem('spotify_auth_state', 'state')
      localStorage.setItem('spotify_code_verifier', 'verifier')

      auth.clearAuth()

      expect(sessionStorage.getItem('spotify_access_token')).toBeNull()
      expect(sessionStorage.getItem('spotify_token_expiry')).toBeNull()
      expect(sessionStorage.getItem('spotify_auth_state')).toBeNull()
      expect(localStorage.getItem('spotify_code_verifier')).toBeNull()
      expect(auth.isAuthenticated()).toBe(false)
    })
  })

  // authenticate
  describe('authenticate()', () => {
    it('stores code_verifier in localStorage and state in sessionStorage, then redirects', async () => {
      // Capture the redirect
      const originalHref = window.location.href
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '',
      } as unknown as Location)

      let redirectedTo = ''
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...window.location,
          set href(url: string) {
            redirectedTo = url
          },
          get href() {
            return originalHref
          },
        },
      })

      await auth.authenticate()

      expect(localStorage.getItem('spotify_code_verifier')).toBeTruthy()
      expect(sessionStorage.getItem('spotify_auth_state')).toBeTruthy()
      expect(redirectedTo).toContain('accounts.spotify.com/authorize')
      expect(redirectedTo).toContain('code_challenge_method=S256')

      locationSpy.mockRestore()
    })
  })

  // handleCallback
  describe('handleCallback()', () => {
    it('throws when state param does not match stored state (CSRF protection)', async () => {
      sessionStorage.setItem('spotify_auth_state', 'correct-state')
      localStorage.setItem('spotify_code_verifier', 'verifier-val')

      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...window.location,
          search: '?code=authcode123&state=wrong-state',
          hash: '',
          pathname: '/',
        },
      })

      await expect(auth.handleCallback()).rejects.toThrow(/state mismatch/i)
    })

    it('throws when no code verifier is found in localStorage', async () => {
      const state = 'abc123'
      sessionStorage.setItem('spotify_auth_state', state)
      // No verifier in localStorage

      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...window.location,
          search: `?code=authcode123&state=${state}`,
          hash: '',
          pathname: '/',
        },
      })

      await expect(auth.handleCallback()).rejects.toThrow(/code verifier/i)
    })

    it('throws when Spotify returns an error param', async () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...window.location,
          search: '?error=access_denied',
          hash: '',
          pathname: '/',
        },
      })

      await expect(auth.handleCallback()).rejects.toThrow(/access_denied/i)
    })

    it('exchanges code for token and stores it on success', async () => {
      const state = 'goodstate'
      sessionStorage.setItem('spotify_auth_state', state)
      localStorage.setItem('spotify_code_verifier', 'verifier-val')

      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...window.location,
          search: `?code=authcode123&state=${state}`,
          hash: '',
          pathname: '/',
        },
      })

      const mockToken = 'access_token_abc'
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: mockToken, expires_in: 3600 }),
      })
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: fetchMock,
      })

      const token = await auth.handleCallback()

      expect(token).toBe(mockToken)
      expect(sessionStorage.getItem('spotify_access_token')).toBe(mockToken)
      expect(sessionStorage.getItem('spotify_token_expiry')).toBeTruthy()
      expect(localStorage.getItem('spotify_code_verifier')).toBeNull()
      expect(sessionStorage.getItem('spotify_auth_state')).toBeNull()
      expect(auth.isAuthenticated()).toBe(true)
    })
  })
})
