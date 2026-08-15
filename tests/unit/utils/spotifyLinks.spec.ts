import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { openSpotifyURI, copyToClipboard } from '@/utils/spotifyLinks'

describe('openSpotifyURI', () => {
  let locationStub: { href: string }
  let openSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    locationStub = { href: '' }
    openSpy = vi.fn()
    // In the jsdom environment globalThis is the window, so stubbing here replaces
    // window.location / window.open for the module under test.
    vi.stubGlobal('location', locationStub)
    vi.stubGlobal('open', openSpy)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('navigates to a track URI', () => {
    openSpotifyURI('spotify:track:abc')
    expect(locationStub.href).toBe('spotify:track:abc')
  })

  it('navigates to a playlist URI', () => {
    openSpotifyURI('spotify:playlist:xyz')
    expect(locationStub.href).toBe('spotify:playlist:xyz')
  })

  it('falls back to the web player for a track', () => {
    openSpotifyURI('spotify:track:abc')
    vi.advanceTimersByTime(1500)
    expect(openSpy).toHaveBeenCalledWith('https://open.spotify.com/track/abc', '_blank')
  })

  it('falls back to the web player for a playlist', () => {
    openSpotifyURI('spotify:playlist:xyz')
    vi.advanceTimersByTime(1500)
    expect(openSpy).toHaveBeenCalledWith('https://open.spotify.com/playlist/xyz', '_blank')
  })

  it('does not open the web player before the fallback delay elapses', () => {
    openSpotifyURI('spotify:track:abc')
    vi.advanceTimersByTime(1000)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('warns and does not navigate for an unrecognised format', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    openSpotifyURI('not-a-uri')
    expect(locationStub.href).toBe('')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('does not open a web player for an unrecognised format', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    openSpotifyURI('not-a-uri')
    vi.advanceTimersByTime(2000)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('does not throw on an empty string', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => openSpotifyURI('')).not.toThrow()
  })
})

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('writes the value to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await copyToClipboard('spotify:track:abc')
    expect(writeText).toHaveBeenCalledWith('spotify:track:abc')
  })

  it('logs and does not throw when the clipboard rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    await expect(copyToClipboard('x')).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
  })
})
