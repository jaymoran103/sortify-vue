import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach } from 'vitest'
import { importCsvText, hashTrackId } from '@/adapters/csvImport'
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
    expect(tracks[0].title).toBe('My Song')
    expect(tracks[0].artist).toBe('My Artist')
    expect(tracks[0].album).toBe('My Album')
  })

  it('generates trackID from title+artist+album when no URI present', async () => {
    const csv = 'title,artist,album\nSong A,Artist B,Album C'
    await importCsvText(csv, 'No ID Playlist')
    const tracks = await db.tracks.toArray()
    expect(tracks[0].trackID).toBe(hashTrackId('Song A', 'Artist B', 'Album C'))
  })

  it('uses spotifyURI as trackID when available', async () => {
    const csv = 'title,artist,album,spotifyURI\nSong A,Artist B,Album C,spotify:track:xyz'
    await importCsvText(csv, 'Playlist')
    const tracks = await db.tracks.toArray()
    expect(tracks[0].trackID).toBe('spotify:track:xyz')
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
    expect(playlists[0].name).toBe('my-playlist')
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
})
