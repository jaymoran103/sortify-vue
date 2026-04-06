import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach } from 'vitest'
import { importJsonBundle } from '@/adapters/jsonImport'
import { db } from '@/db'
import type { Track } from '@/types/models'

const sampleTrack: Track = {
  trackID: 't1',
  title: 'Song 1',
  artist: 'Artist 1',
  album: 'Album 1',
  source: 'csv',
}

describe('jsonImport', () => {
  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
  })

  it('imports valid JSON bundle with tracks and playlists', async () => {
    const bundle = {
      tracks: [sampleTrack],
      playlists: [{ name: 'PL1', trackIDs: ['t1'] }],
    }
    const result = await importJsonBundle(bundle)
    expect(result.tracksImported).toBe(1)
    expect(result.playlistsImported).toBe(1)
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    const track = tracks[0]!
    expect(track.trackID).toBe('t1')
  })

  it('rejects file missing tracks array', async () => {
    await expect(importJsonBundle({ playlists: [] })).rejects.toThrow('missing tracks')
  })

  it('rejects file missing playlists array', async () => {
    await expect(importJsonBundle({ tracks: [] })).rejects.toThrow('missing playlists')
  })

  it('strips existing id from playlists before storing', async () => {
    const bundle = {
      tracks: [sampleTrack],
      playlists: [{ id: 999, name: 'PL1', trackIDs: ['t1'] }],
    }
    await importJsonBundle(bundle)
    const playlists = await db.playlists.toArray()
    expect(playlists).toHaveLength(1)
    const playlist = playlists[0]!
    expect(playlist.id).not.toBe(999)
    expect(typeof playlist.id).toBe('number')
  })

  it('reports correct import counts', async () => {
    const bundle = {
      tracks: [
        sampleTrack,
        { trackID: 't2', title: 'S2', artist: 'A2', album: 'Al2', source: 'csv' as const },
      ],
      playlists: [{ name: 'PL1', trackIDs: ['t1', 't2'] }],
    }
    const result = await importJsonBundle(bundle)
    expect(result.tracksImported).toBe(2)
    expect(result.playlistsImported).toBe(1)
  })
})
