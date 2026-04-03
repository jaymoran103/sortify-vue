import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { importCsvText } from '@/adapters/csvImport'
import { buildJsonBundle } from '@/adapters/jsonExport'
import { importJsonBundle } from '@/adapters/jsonImport'
import { db } from '@/db'

vi.mock('@/utils/download', () => ({ triggerDownload: vi.fn() }))

describe('adapter integration', () => {
  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
  })

  it('import CSV file → verify tracks and playlists appear in store', async () => {
    const csv =
      'trackID,title,artist,album\nt1,Song 1,Artist 1,Album 1\nt2,Song 2,Artist 2,Album 2'
    const result = await importCsvText(csv, 'My Playlist')
    expect(result.tracksImported).toBe(2)
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(2)
    const playlists = await db.playlists.toArray()
    expect(playlists[0].name).toBe('My Playlist')
    expect(playlists[0].trackIDs).toHaveLength(2)
  })

  it('export as JSON → re-import JSON → verify data matches', async () => {
    const csv = 'trackID,title,artist,album\nt1,Song 1,Artist 1,Album 1'
    await importCsvText(csv, 'Test Playlist')

    const tracks = await db.tracks.toArray()
    const playlists = await db.playlists.toArray()
    const bundle = buildJsonBundle(tracks, playlists)

    await db.tracks.clear()
    await db.playlists.clear()

    await importJsonBundle(bundle)

    const reimportedTracks = await db.tracks.toArray()
    const reimportedPlaylists = await db.playlists.toArray()
    expect(reimportedTracks).toHaveLength(1)
    expect(reimportedTracks[0].trackID).toBe('t1')
    expect(reimportedPlaylists[0].name).toBe('Test Playlist')
  })

  it('import JSON bundle → verify correct track/playlist counts', async () => {
    const bundle = {
      tracks: [
        { trackID: 't1', title: 'S1', artist: 'A1', album: 'Al1', source: 'csv' as const },
        { trackID: 't2', title: 'S2', artist: 'A2', album: 'Al2', source: 'csv' as const },
      ],
      playlists: [
        { name: 'PL1', trackIDs: ['t1', 't2'] },
        { name: 'PL2', trackIDs: ['t1'] },
      ],
    }
    const result = await importJsonBundle(bundle)
    expect(result.tracksImported).toBe(2)
    expect(result.playlistsImported).toBe(2)
  })
})
