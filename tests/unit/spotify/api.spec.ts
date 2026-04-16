import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SpotifyApi } from '@/spotify/api'
import { SpotifyAuth } from '@/spotify/auth'

let originalFetch: typeof globalThis.fetch | undefined

function makeAuth(authenticated = true): SpotifyAuth {
  sessionStorage.clear()
  if (typeof globalThis.localStorage?.clear === 'function') {
    globalThis.localStorage.clear()
  }

  const auth = new SpotifyAuth()
  if (authenticated) {
    sessionStorage.setItem('spotify_access_token', 'test-token')
    sessionStorage.setItem('spotify_token_expiry', String(Date.now() + 60_000))
  }
  return auth
}

describe('SpotifyApi', () => {
  let api: SpotifyApi

  beforeEach(() => {
    originalFetch = globalThis.fetch
    sessionStorage.clear()
    vi.useFakeTimers()
    api = new SpotifyApi(makeAuth())
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.useRealTimers()
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
      })
    }
  })

  describe('get()', () => {
    it('fetches from the correct Spotify base URL and endpoint', async () => {
      const mockData = { id: 'user1', display_name: 'Test' }
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
        headers: new Headers(),
      })
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: fetchMock,
      })

      const result = await api.get('/me')
      expect(result).toEqual(mockData)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('includes Authorization header with Bearer token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
      })
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: fetchMock,
      })

      await api.get('/me')
      const firstCall = fetchMock.mock.calls[0] as [unknown, RequestInit] | undefined
      expect(firstCall).toBeDefined()
      const init = firstCall![1]
      expect(init.headers).toMatchObject({
        Authorization: 'Bearer test-token',
      })
    })

    it('throws when not authenticated', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, headers: new Headers() })
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: fetchMock,
      })

      const unauthApi = new SpotifyApi(makeAuth(false))
      await expect(unauthApi.get('/me')).rejects.toThrow(/not authenticated/i)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('throws with status and endpoint info on non-429 error', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: new Headers() })
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: fetchMock,
      })

      await expect(api.get('/me/playlists')).rejects.toThrow(/404.*\/me\/playlists/i)
    })

    it('throws immediately on 429 when ABORT_ON_FIRST_429 is true', async () => {
      const headers = new Headers({ 'Retry-After': '5' })
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, headers })
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: fetchMock,
      })

      await expect(api.get('/me')).rejects.toThrow(/rate limited/i)
    })
  })

  describe('post()', () => {
    it('sends body as JSON', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
      })
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: fetchMock,
      })

      const body = { uris: ['spotify:track:123'] }
      await api.post('/playlists/abc/tracks', body)

      const firstCall = fetchMock.mock.calls[0] as [unknown, RequestInit] | undefined
      expect(firstCall).toBeDefined()
      const init = firstCall![1]
      expect(init.method).toBe('POST')
      expect(init.body).toBe(JSON.stringify(body))
    })
  })
})
