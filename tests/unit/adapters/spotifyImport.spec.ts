import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { spotifyImportAdapter } from '@/adapters/spotifyImport'
import { db } from '@/db'
import type { SpotifyPlaylistSummary } from '@/spotify/types'
import { spotifyApi } from '@/spotify/api'
import { spotifyAuth } from '@/spotify/auth'

vi.mock('@/spotify/api', () => ({
  spotifyApi: {
    get: vi.fn(),
  },
}))

vi.mock('@/spotify/auth', () => ({
  spotifyAuth: {
    getAccessToken: vi.fn(() => 'test-token'),
  },
}))

const samplePlaylist: SpotifyPlaylistSummary = {
  id: 'playlist-1',
  name: 'Road Trip',
  tracks: { total: 2 },
  owner: { display_name: 'Tester' },
  images: [],
}

describe('spotifyImportAdapter', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(spotifyAuth.getAccessToken).mockReturnValue('test-token')
    await db.tracks.clear()
    await db.playlists.clear()
  })

  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
  })

  it('imports Spotify playlist items into the database and creates a playlist', async () => {
    vi.mocked(spotifyApi.get).mockResolvedValue({
      items: [
        {
          item: {
            type: 'track',
            uri: 'spotify:track:1',
            name: 'Track One',
            album: { name: 'Album One' },
            artists: [{ name: 'Artist One' }],
            duration_ms: 123000,
            explicit: false,
          },
        },
        {
          item: {
            type: 'track',
            uri: 'spotify:track:2',
            name: 'Track Two',
            album: { name: 'Album Two' },
            artists: [{ name: 'Artist Two' }],
            duration_ms: 456000,
            explicit: false,
          },
        },
      ],
      total: 2,
      next: null,
      offset: 0,
      limit: 50,
    })

    const progress = vi.fn()
    const result = await spotifyImportAdapter.import({ playlists: [samplePlaylist] }, progress)

    expect(result.tracksImported).toBe(2)
    expect(result.playlistsImported).toBe(1)
    expect(result.errors).toEqual([])
    expect(progress).toHaveBeenCalledWith(2, 2, 'Road Trip')

    const tracks = await db.tracks.toArray()
    const playlists = await db.playlists.toArray()
    expect(tracks).toHaveLength(2)
    expect(playlists).toHaveLength(1)
    expect(playlists[0]?.playlistURI).toBe('spotify:playlist:playlist-1')
    expect(playlists[0]?.trackIDs).toEqual(['spotify:track:1', 'spotify:track:2'])
  })

  it('skips episode and null items', async () => {
    vi.mocked(spotifyApi.get).mockResolvedValue({
      items: [
        {
          added_at: '2026-04-17T00:00:00Z',
          added_by: {
            external_urls: { spotify: 'https://open.spotify.com/user/test' },
            href: 'https://api.spotify.com/v1/users/test',
            id: 'test',
            type: 'user',
            uri: 'spotify:user:test',
          },
          is_local: false,
          primary_color: null,
          item: {
            type: 'episode',
            uri: 'spotify:episode:1',
            name: 'Podcast Episode',
            duration_ms: 3600000,
          },
          video_thumbnail: { url: null },
        },
        {
          item: null,
        },
      ],
      total: 2,
      next: null,
      offset: 0,
      limit: 50,
    })

    const result = await spotifyImportAdapter.import({ playlists: [samplePlaylist] })

    expect(result.tracksImported).toBe(0)
  })

  it('skips null track items and reuses existing track ids', async () => {
    await db.tracks.put({
      trackID: 'spotify:track:existing',
      title: 'Existing',
      artist: 'Artist',
      album: 'Album',
      source: 'spotify',
      spotifyURI: 'spotify:track:existing',
      duration: 1000,
    })

    vi.mocked(spotifyApi.get).mockResolvedValue({
      items: [
        { item: null },
        {
          item: {
            type: 'track',
            uri: 'spotify:track:existing',
            name: 'Existing',
            album: { name: 'Album' },
            artists: [{ name: 'Artist' }],
            duration_ms: 1000,
            explicit: false,
          },
        },
      ],
      total: 2,
      next: null,
      offset: 0,
      limit: 50,
    })

    const result = await spotifyImportAdapter.import({ playlists: [samplePlaylist] })

    expect(result.tracksImported).toBe(1)
    const tracks = await db.tracks.toArray()
    const playlists = await db.playlists.toArray()
    expect(tracks).toHaveLength(1)
    expect(playlists[0]?.trackIDs).toEqual(['spotify:track:existing'])
  })

  it('skips 403 playlists and continues importing later selections', async () => {
    const secondPlaylist: SpotifyPlaylistSummary = {
      id: 'playlist-2',
      name: 'Keep Me',
      tracks: { total: 1 },
      owner: { display_name: 'Tester' },
      images: [],
    }

    vi.mocked(spotifyApi.get)
      .mockRejectedValueOnce(new Error('Spotify API error 403 on /playlists/playlist-1/items?limit=50'))
      .mockResolvedValueOnce({
        items: [
          {
            item: {
              type: 'track',
              uri: 'spotify:track:ok',
              name: 'Imported',
              album: { name: 'Album' },
              artists: [{ name: 'Artist' }],
              duration_ms: 222000,
              explicit: false,
            },
          },
        ],
        total: 1,
        next: null,
        offset: 0,
        limit: 50,
      })

    const result = await spotifyImportAdapter.import({ playlists: [samplePlaylist, secondPlaylist] })

    expect(result.playlistsImported).toBe(1)
    expect(result.tracksImported).toBe(1)
    expect(result.errors).toContain('Skipped playlist Road Trip: permission denied')
    const playlists = await db.playlists.toArray()
    expect(playlists).toHaveLength(1)
    expect(playlists[0]?.name).toBe('Keep Me')
  })

  it('throws when no Spotify access token is available', async () => {
    vi.mocked(spotifyAuth.getAccessToken).mockReturnValue(null)

    await expect(spotifyImportAdapter.import({ playlists: [samplePlaylist] })).rejects.toThrow(
      /not authenticated/i,
    )
  })

  it('reports progress against declared summary totals, not per-page counts', async () => {
    vi.mocked(spotifyApi.get).mockResolvedValue({
      items: [
        {
          item: {
            type: 'track',
            uri: 'spotify:track:1',
            name: 'Track One',
            album: { name: 'Album One' },
            artists: [{ name: 'Artist One' }],
            duration_ms: 123000,
            explicit: false,
          },
        },
        {
          item: {
            type: 'track',
            uri: 'spotify:track:2',
            name: 'Track Two',
            album: { name: 'Album Two' },
            artists: [{ name: 'Artist Two' }],
            duration_ms: 456000,
            explicit: false,
          },
        },
      ],
      total: 2,
      next: null,
      offset: 0,
      limit: 50,
    })

    const progress = vi.fn()
    const zeroTotalPlaylist: SpotifyPlaylistSummary = {
      ...samplePlaylist,
      tracks: { total: 0 },
    }

    await spotifyImportAdapter.import({ playlists: [zeroTotalPlaylist] }, progress)

    expect(progress).toHaveBeenCalledWith(2, 0, 'Road Trip')
  })

  it('logs episode diagnostics when Spotify returns null track items', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(spotifyApi.get).mockResolvedValue({
      items: [
        {
          item: {
            type: 'episode',
            uri: 'spotify:episode:1',
            name: 'Podcast Episode',
          },
        },
      ],
      total: 1,
      next: null,
      offset: 0,
      limit: 50,
    })

    await spotifyImportAdapter.import({ playlists: [samplePlaylist] })

    expect(warnSpy).toHaveBeenCalledWith(
      '[SpotifyImport] Skipped Spotify playlist items with null tracks',
      expect.objectContaining({
        playlistName: 'Road Trip',
        skippedNullTracks: 1,
        skippedEpisodes: 1,
        skippedUnknownItems: 0,
      }),
    )

    warnSpy.mockRestore()
  })
})