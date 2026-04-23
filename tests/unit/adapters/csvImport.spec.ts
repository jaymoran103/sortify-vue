import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach } from 'vitest'
import { importCsvText, hashTrackId, resolveSpotifyURI } from '@/adapters/csvImport'
import { db } from '@/db'

describe('csvImport', () => {
  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
  })

  it('parses simple CSV with standard headers', async () => {
    const csv =
      'trackID,title,artist,album\nspotify:track:abc,Test Song,Test Artist,Test Album'
    const result = await importCsvText(csv, 'My Playlist')
    expect(result.tracksImported).toBe(1)
    expect(result.playlistsImported).toBe(1)
  })

  it('maps aliased headers (track_name, artist_name, album_name)', async () => {
    const csv = 'track_name,artist_name,album_name\nMy Song,My Artist,My Album'
    const result = await importCsvText(csv, 'Alias Test')
    expect(result.tracksImported).toBe(1)
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    const track = tracks[0]!
    expect(track.title).toBe('My Song')
    expect(track.artist).toBe('My Artist')
    expect(track.album).toBe('My Album')
  })

  it('generates trackID from title+artist+album when no URI present', async () => {
    const csv = 'title,artist,album\nSong A,Artist B,Album C'
    await importCsvText(csv, 'No ID Playlist')
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    const track = tracks[0]!
    expect(track.trackID).toBe(hashTrackId('Song A', 'Artist B', 'Album C'))
  })

  it('uses spotifyURI as trackID when available', async () => {
    const csv = 'title,artist,album,spotifyURI\nSong A,Artist B,Album C,spotify:track:xyz'
    await importCsvText(csv, 'Playlist')
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    const track = tracks[0]!
    expect(track.trackID).toBe('spotify:track:xyz')
  })

  it('skips rows with missing title', async () => {
    const csv =
      'trackID,title,artist,album\nspotify:track:1,Song One,Artist One,Album One\nspotify:track:2,,Artist Two,Album Two'
    const result = await importCsvText(csv, 'Playlist')
    expect(result.tracksImported).toBe(1)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('deduplicates tracks by trackID', async () => {
    const csv = 'trackID,title,artist,album\nabc,Song,Artist,Album\nabc,Song Dup,Artist,Album'
    const result = await importCsvText(csv, 'Playlist')
    expect(result.tracksImported).toBe(1)
    const tracks = await db.tracks.toArray()
    expect(tracks.length).toBe(1)
  })

  it('derives playlist name from filename', async () => {
    const csv = 'trackID,title,artist,album\nspotify:track:1,Song,Artist,Album'
    await importCsvText(csv, 'my-playlist')
    const playlists = await db.playlists.toArray()
    expect(playlists).toHaveLength(1)
    const playlist = playlists[0]!
    expect(playlist.name).toBe('my-playlist')
  })

  it('reports correct tracksImported and playlistsImported counts', async () => {
    const csv =
      'trackID,title,artist,album\nt1,Song 1,Artist 1,Album 1\nt2,Song 2,Artist 2,Album 2'
    const result = await importCsvText(csv, 'Playlist')
    expect(result.tracksImported).toBe(2)
    expect(result.playlistsImported).toBe(1)
  })

  it('calls onProgress with correct done/total values', async () => {
    const csv =
      'trackID,title,artist,album\nt1,Song 1,Artist 1,Album 1\nt2,Song 2,Artist 2,Album 2'
    const calls: [number, number][] = []
    await importCsvText(csv, 'Playlist', (done, total) => calls.push([done, total]))
    expect(calls.length).toBe(2)
    expect(calls[0]).toEqual([1, 2])
    expect(calls[1]).toEqual([2, 2])
  })

  it('promotes Spotify-format trackID to spotifyURI when "track uri" column used', async () => {
    const csv =
      'track uri,title,artist,album\nspotify:track:4NtwoZQaUXX082YmRQ2qcN,Song,Artist,Album'
    await importCsvText(csv, 'Playlist')
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.spotifyURI).toBe('spotify:track:4NtwoZQaUXX082YmRQ2qcN')
  })

  it('promotes Spotify-format trackID to spotifyURI when "uri" column used', async () => {
    const csv = 'uri,title,artist,album\nspotify:track:abc123def,Song,Artist,Album'
    await importCsvText(csv, 'Playlist')
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.spotifyURI).toBe('spotify:track:abc123def')
  })

  it('does not promote non-Spotify trackID to spotifyURI', async () => {
    const csv = 'trackID,title,artist,album\ngen_abc123,Song,Artist,Album'
    await importCsvText(csv, 'Playlist')
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.spotifyURI).toBeUndefined()
  })

  it('explicit spotifyURI column takes precedence over trackID promotion', async () => {
    const csv =
      'trackID,title,artist,album,spotifyURI\nspotify:track:aaa,Song,Artist,Album,spotify:track:bbb'
    await importCsvText(csv, 'Playlist')
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.spotifyURI).toBe('spotify:track:bbb')
  })

  describe('resolveSpotifyURI', () => {
    it('returns explicit URI when provided', () => {
      expect(resolveSpotifyURI('spotify:track:aaa', 'spotify:track:bbb')).toBe('spotify:track:bbb')
    })

    it('promotes Spotify-format trackID when no explicit URI', () => {
      expect(resolveSpotifyURI('spotify:track:abc123', undefined)).toBe('spotify:track:abc123')
    })

    it('returns undefined for non-Spotify trackID with no explicit URI', () => {
      expect(resolveSpotifyURI('gen_abc123', undefined)).toBeUndefined()
    })
  })
})
