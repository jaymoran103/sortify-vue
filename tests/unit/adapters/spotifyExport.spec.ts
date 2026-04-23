import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { spotifyExportAdapter, resolveExportURI } from '@/adapters/spotifyExport'
import { db } from '@/db'
import { spotifyApi } from '@/spotify/api'
import { spotifyAuth } from '@/spotify/auth'

vi.mock('@/spotify/api', () => ({
  spotifyApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/spotify/auth', () => ({
  spotifyAuth: {
    getAccessToken: vi.fn(() => 'test-token'),
  },
}))

// Shorten the between-playlist sleep so tests run fast
vi.mock('@/spotify/config', () => ({
  SLEEP_BETWEEN_PLAYLISTS_MS: 0,
  SLEEP_BETWEEN_REQUESTS_MS: 0,
  MAX_RETRIES: 3,
  ABORT_ON_FIRST_429: true,
}))

const spotifyPostMock = vi.mocked(spotifyApi.post)
const spotifyAuthGetAccessTokenMock = vi.mocked(spotifyAuth.getAccessToken)

const sampleTrack = {
  trackID: 'spotify:track:abc',
  title: 'Track One',
  artist: 'Artist One',
  album: 'Album One',
  source: 'spotify' as const,
  spotifyURI: 'spotify:track:abc',
  duration: 200000,
}

describe('spotifyExportAdapter', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    spotifyAuthGetAccessTokenMock.mockReturnValue('test-token')
    // Default: POST /me/playlists returns a new playlist; POST /playlists/{id}/items returns snapshot
    spotifyPostMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/me/playlists') {
        return Promise.resolve({
          id: 'new-spotify-playlist-id',
          external_urls: { spotify: 'https://open.spotify.com/playlist/new-spotify-playlist-id' },
          name: 'My Playlist',
        })
      }
      return Promise.resolve({ snapshot_id: 'snap-1' })
    })
    await db.tracks.clear()
    await db.playlists.clear()
  })

  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
  })

  it('exports a playlist to Spotify, creating it and adding tracks', async () => {
    await db.tracks.put(sampleTrack)
    const playlistId = await db.playlists.add({
      name: 'My Playlist',
      trackIDs: [sampleTrack.trackID],
      timeAdded: Date.now(),
      lastModified: Date.now(),
    })

    const result = await spotifyExportAdapter.export({ playlistIds: [playlistId] })

    expect(result.playlistsExported).toBe(1)
    expect(result.errors).toEqual([])
    expect(result.createdPlaylists).toContainEqual({
      name: 'My Playlist', spotifyId: 'new-spotify-playlist-id'
    })

    // Should have called POST /me/playlists once
    expect(spotifyPostMock).toHaveBeenCalledWith('/me/playlists', {
      name: 'My Playlist',
      public: false,
      description: 'Exported from Sortify',
    })
    // Should have called POST /playlists/{id}/items with the track URI
    expect(spotifyPostMock).toHaveBeenCalledWith(
      '/playlists/new-spotify-playlist-id/items',
      { uris: ['spotify:track:abc'] },
    )
  })

  it('skips playlists with no valid Spotify track URIs and records a warning', async () => {
    const csvTrack = {
      trackID: 'csv-track-1',
      title: 'CSV Track',
      artist: 'Artist',
      album: 'Album',
      source: 'csv' as const,
      duration: 180000,
    }
    await db.tracks.put(csvTrack)
    const playlistId = await db.playlists.add({
      name: 'CSV Playlist',
      trackIDs: [csvTrack.trackID],
      timeAdded: Date.now(),
      lastModified: Date.now(),
    })

    const result = await spotifyExportAdapter.export({ playlistIds: [playlistId] })

    expect(result.playlistsExported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('CSV Playlist')
    expect(result.errors[0]).toContain('no tracks with Spotify URIs')
    expect(spotifyPostMock).not.toHaveBeenCalled()
  })

  it('throws when no Spotify access token is available', async () => {
    spotifyAuthGetAccessTokenMock.mockReturnValue(null)

    await expect(spotifyExportAdapter.export({ playlistIds: [1] })).rejects.toThrow(
      /not authenticated/i,
    )
  })

  it('calls onProgress once per exported playlist', async () => {
    await db.tracks.put(sampleTrack)
    const secondTrack = {
      ...sampleTrack,
      trackID: 'spotify:track:def',
      spotifyURI: 'spotify:track:def',
    }
    await db.tracks.put(secondTrack)

    const id1 = await db.playlists.add({
      name: 'Playlist One',
      trackIDs: [sampleTrack.trackID],
      timeAdded: Date.now(),
      lastModified: Date.now(),
    })
    const id2 = await db.playlists.add({
      name: 'Playlist Two',
      trackIDs: [secondTrack.trackID],
      timeAdded: Date.now(),
      lastModified: Date.now(),
    })

    // Give each POST /me/playlists call a unique ID
    spotifyPostMock.mockImplementation((endpoint: string, body: unknown) => {
      if (endpoint === '/me/playlists') {
        const name = (body as { name: string }).name
        return Promise.resolve({
          id: `spotify-id-${name}`,
          external_urls: { spotify: `https://open.spotify.com/playlist/spotify-id-${name}` },
          name,
        })
      }
      return Promise.resolve({ snapshot_id: 'snap-1' })
    })

    const progress = vi.fn()
    const result = await spotifyExportAdapter.export({ playlistIds: [id1, id2] }, progress)

    expect(result.playlistsExported).toBe(2)
    expect(progress).toHaveBeenCalledTimes(2)
    expect(progress).toHaveBeenNthCalledWith(1, 1, 2, 'Playlist One')
    expect(progress).toHaveBeenNthCalledWith(2, 2, 2, 'Playlist Two')
  })

  it('chunks tracks into batches of 50 when a playlist has more than 50 tracks', async () => {
    // Seed 105 tracks; with CHUNK_SIZE=50: 3 batches (50 + 50 + 5)
    const trackIDs: string[] = []
    for (let i = 0; i < 105; i++) {
      const uri = `spotify:track:t${i}`
      await db.tracks.put({
        trackID: uri,
        title: `Track ${i}`,
        artist: 'Artist',
        album: 'Album',
        source: 'spotify',
        spotifyURI: uri,
        duration: 180000,
      })
      trackIDs.push(uri)
    }

    const playlistId = await db.playlists.add({
      name: 'Big Playlist',
      trackIDs,
      timeAdded: Date.now(),
      lastModified: Date.now(),
    })

    const result = await spotifyExportAdapter.export({ playlistIds: [playlistId] })

    expect(result.playlistsExported).toBe(1)
    const addItemsCalls = spotifyPostMock.mock.calls.filter(([ep]) =>
      (ep as string).includes('/items'),
    )
    expect(addItemsCalls).toHaveLength(3)
    expect((addItemsCalls[0]![1] as { uris: string[] }).uris).toHaveLength(50)
    expect((addItemsCalls[1]![1] as { uris: string[] }).uris).toHaveLength(50)
    expect((addItemsCalls[2]![1] as { uris: string[] }).uris).toHaveLength(5)
  })

  it('records a warning and continues when a playlist ID is not found in IDB', async () => {
    const result = await spotifyExportAdapter.export({ playlistIds: [9999] })

    expect(result.playlistsExported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('9999')
    expect(spotifyPostMock).not.toHaveBeenCalled()
  })

  it('exports only tracks with valid spotify:track: URIs, silently skipping others', async () => {
    const spotifyTrack = { ...sampleTrack }
    const nonSpotifyTrack = {
      ...sampleTrack,
      trackID: 'local:track:local',
      spotifyURI: 'local:track:local', // not a spotify:track: URI
    }
    await db.tracks.put(spotifyTrack)
    await db.tracks.put(nonSpotifyTrack)

    const playlistId = await db.playlists.add({
      name: 'Mixed Playlist',
      trackIDs: [spotifyTrack.trackID, nonSpotifyTrack.trackID],
      timeAdded: Date.now(),
      lastModified: Date.now(),
    })

    await spotifyExportAdapter.export({ playlistIds: [playlistId] })

    const addItemsCalls = spotifyPostMock.mock.calls.filter(([ep]) =>
      (ep as string).includes('/items'),
    )
    expect(addItemsCalls).toHaveLength(1)
    expect((addItemsCalls[0]![1] as { uris: string[] }).uris).toEqual(['spotify:track:abc'])
  })

  it('exports track using trackID as URI when spotifyURI is missing but trackID is Spotify format', async () => {
    const noUriTrack = {
      trackID: 'spotify:track:nouri1',
      title: 'No URI Track',
      artist: 'Artist',
      album: 'Album',
      source: 'spotify' as const,
    }
    await db.tracks.put(noUriTrack)
    const playlistId = await db.playlists.add({
      name: 'Legacy Playlist',
      trackIDs: [noUriTrack.trackID],
      timeAdded: Date.now(),
      lastModified: Date.now(),
    })

    const result = await spotifyExportAdapter.export({ playlistIds: [playlistId] })

    expect(result.playlistsExported).toBe(1)
    expect(result.errors).toEqual([])
    const addItemsCalls = spotifyPostMock.mock.calls.filter(([ep]) =>
      (ep as string).includes('/items'),
    )
    expect(addItemsCalls).toHaveLength(1)
    expect((addItemsCalls[0]![1] as { uris: string[] }).uris).toEqual(['spotify:track:nouri1'])
  })

  it('skips track when both spotifyURI and trackID are non-Spotify format', async () => {
    const nonSpotifyTrack = {
      trackID: 'gen_abc123',
      title: 'Local Track',
      artist: 'Artist',
      album: 'Album',
      source: 'csv' as const,
    }
    await db.tracks.put(nonSpotifyTrack)
    const playlistId = await db.playlists.add({
      name: 'Non-Spotify Playlist',
      trackIDs: [nonSpotifyTrack.trackID],
      timeAdded: Date.now(),
      lastModified: Date.now(),
    })

    const result = await spotifyExportAdapter.export({ playlistIds: [playlistId] })

    expect(result.playlistsExported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('no tracks with Spotify URIs')
  })

  describe('resolveExportURI', () => {
    it('returns spotifyURI when valid', () => {
      expect(resolveExportURI({ trackID: 'gen_x', title: '', artist: '', album: '', source: 'csv', spotifyURI: 'spotify:track:abc' })).toBe('spotify:track:abc')
    })

    it('falls back to trackID when spotifyURI is absent but trackID is Spotify format', () => {
      expect(resolveExportURI({ trackID: 'spotify:track:abc', title: '', artist: '', album: '', source: 'spotify' })).toBe('spotify:track:abc')
    })

    it('returns undefined when neither is a valid Spotify URI', () => {
      expect(resolveExportURI({ trackID: 'gen_abc', title: '', artist: '', album: '', source: 'csv' })).toBeUndefined()
    })

    it('returns undefined when spotifyURI is a non-track Spotify URI', () => {
      expect(resolveExportURI({ trackID: 'gen_abc', title: '', artist: '', album: '', source: 'csv', spotifyURI: 'spotify:album:xyz' })).toBeUndefined()
    })
  })
})
