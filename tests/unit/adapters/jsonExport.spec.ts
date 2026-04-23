import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildJsonBundle, jsonExportAdapter } from '@/adapters/jsonExport'
import { db } from '@/db'
import type { Track, Playlist } from '@/types/models'

vi.mock('@/utils/download', () => ({ triggerDownload: vi.fn() }))

const track1: Track = { trackID: 't1', title: 'Song', artist: 'Artist', album: 'Album', source: 'csv' }
const track2: Track = { trackID: 't2', title: 'Song 2', artist: 'Artist 2', album: 'Album 2', source: 'csv' }
const orphan: Track = { trackID: 'orphan', title: 'Orphan', artist: 'Nobody', album: 'None', source: 'csv' }
const playlist: Playlist = { id: 1, name: 'PL', trackIDs: ['t1'] }

describe('buildJsonBundle', () => {
  it('includes all provided tracks and playlists', () => {
    const bundle = buildJsonBundle([track1], [playlist])
    expect(bundle.tracks).toHaveLength(1)
    expect(bundle.playlists).toHaveLength(1)
    expect(bundle.tracks[0]!.trackID).toBe('t1')
  })

  it('includes exportedAt timestamp', () => {
    const bundle = buildJsonBundle([track1], [playlist])
    expect(bundle.exportedAt).toBeDefined()
    expect(typeof bundle.exportedAt).toBe('string')
    expect(new Date(bundle.exportedAt).getTime()).not.toBeNaN()
  })

  it('output is valid JSON', () => {
    const bundle = buildJsonBundle([track1], [playlist])
    const json = JSON.stringify(bundle)
    expect(() => JSON.parse(json)).not.toThrow()
    const parsed = JSON.parse(json) as { tracks: unknown[]; playlists: unknown[] }
    expect(parsed.tracks).toHaveLength(1)
    expect(parsed.playlists).toHaveLength(1)
  })
})

describe('jsonExportAdapter', () => {
  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
  })

  it('exports only selected playlist and its tracks when given specific IDs', async () => {
    await db.tracks.bulkPut([track1, track2])
    const id1 = await db.playlists.add({ name: 'PL1', trackIDs: ['t1'] })
    await db.playlists.add({ name: 'PL2', trackIDs: ['t2'] })

    const { triggerDownload } = await import('@/utils/download')
    const spy = vi.mocked(triggerDownload)
    spy.mockClear()

    const result = await jsonExportAdapter.export({ playlistIds: [id1 as number] })

    expect(result.playlistsExported).toBe(1)
    const downloaded = spy.mock.calls[0]![1] as string
    const bundle = JSON.parse(downloaded) as { tracks: Track[]; playlists: Playlist[] }
    expect(bundle.playlists).toHaveLength(1)
    expect(bundle.playlists[0]!.name).toBe('PL1')
    expect(bundle.tracks).toHaveLength(1)
    expect(bundle.tracks[0]!.trackID).toBe('t1')
  })

  it('excludes tracks not referenced by selected playlists', async () => {
    await db.tracks.bulkPut([track1, track2])
    const id1 = await db.playlists.add({ name: 'PL1', trackIDs: ['t1'] })
    await db.playlists.add({ name: 'PL2', trackIDs: ['t2'] })

    const { triggerDownload } = await import('@/utils/download')
    const spy = vi.mocked(triggerDownload)
    spy.mockClear()

    await jsonExportAdapter.export({ playlistIds: [id1 as number] })

    const downloaded = spy.mock.calls[0]![1] as string
    const bundle = JSON.parse(downloaded) as { tracks: Track[] }
    expect(bundle.tracks.find((t) => t.trackID === 't2')).toBeUndefined()
  })

  it('exports all playlists and their tracks when playlistIds is "all"', async () => {
    await db.tracks.bulkPut([track1, track2])
    await db.playlists.add({ name: 'PL1', trackIDs: ['t1'] })
    await db.playlists.add({ name: 'PL2', trackIDs: ['t2'] })

    const { triggerDownload } = await import('@/utils/download')
    const spy = vi.mocked(triggerDownload)
    spy.mockClear()

    const result = await jsonExportAdapter.export({ playlistIds: 'all' })

    expect(result.playlistsExported).toBe(2)
    const downloaded = spy.mock.calls[0]![1] as string
    const bundle = JSON.parse(downloaded) as { tracks: Track[]; playlists: Playlist[] }
    expect(bundle.playlists).toHaveLength(2)
    expect(bundle.tracks).toHaveLength(2)
  })

  it('excludes orphaned tracks even when playlistIds is "all"', async () => {
    await db.tracks.bulkPut([track1, orphan])
    await db.playlists.add({ name: 'PL1', trackIDs: ['t1'] })

    const { triggerDownload } = await import('@/utils/download')
    const spy = vi.mocked(triggerDownload)
    spy.mockClear()

    await jsonExportAdapter.export({ playlistIds: 'all' })

    const downloaded = spy.mock.calls[0]![1] as string
    const bundle = JSON.parse(downloaded) as { tracks: Track[] }
    expect(bundle.tracks).toHaveLength(1)
    expect(bundle.tracks.find((t) => t.trackID === 'orphan')).toBeUndefined()
  })

  it('returns zero playlists exported when given empty playlist ID list', async () => {
    await db.tracks.put(track1)

    const result = await jsonExportAdapter.export({ playlistIds: [] })

    expect(result.playlistsExported).toBe(0)
  })
})
