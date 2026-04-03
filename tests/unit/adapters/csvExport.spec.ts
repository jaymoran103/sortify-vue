import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { generateCsv, csvExportAdapter } from '@/adapters/csvExport'
import { db } from '@/db'
import type { Track } from '@/types/models'

vi.mock('@/utils/download', () => ({ triggerDownload: vi.fn() }))

const track: Track = {
  trackID: 'spotify:track:abc',
  title: 'My Song',
  artist: 'My Artist',
  album: 'My Album',
  source: 'spotify',
  duration: 200000,
  genre: 'Pop',
}

describe('csvExport', () => {
  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
  })

  it('exports playlist tracks as CSV with correct headers', () => {
    const csv = generateCsv([track], 'minimal')
    const headerLine = csv.split('\n')[0]
    expect(headerLine).toBe('title,artist,album')
  })

  it('full profile includes all track fields', () => {
    const csv = generateCsv([track], 'full')
    const header = csv.split('\n')[0]
    expect(header).toContain('trackID')
    expect(header).toContain('title')
    expect(header).toContain('artist')
    expect(header).toContain('album')
  })

  it('minimal profile includes only title, artist, album', () => {
    const csv = generateCsv([track], 'minimal')
    const header = csv.split('\n')[0]
    expect(header).toBe('title,artist,album')
    expect(header).not.toContain('trackID')
  })

  it('handles tracks with commas in field values', () => {
    const t = { ...track, title: 'Hello, World' }
    const csv = generateCsv([t], 'minimal')
    const row = csv.split('\n')[1]
    expect(row).toContain('"Hello, World"')
  })

  it('handles tracks with quotes in field values', () => {
    const t = { ...track, title: 'Say "Hello"' }
    const csv = generateCsv([t], 'minimal')
    const row = csv.split('\n')[1]
    expect(row).toContain('"Say ""Hello"""')
  })

  it('calls onProgress for each playlist', async () => {
    await db.tracks.put(track)
    await db.playlists.add({ name: 'PL1', trackIDs: [track.trackID], lastModified: Date.now() })
    await db.playlists.add({ name: 'PL2', trackIDs: [track.trackID], lastModified: Date.now() })
    const calls: [number, number][] = []
    await csvExportAdapter.export(
      { playlistIds: 'all', profile: 'minimal' },
      (done, total) => calls.push([done, total]),
    )
    expect(calls).toEqual([
      [1, 2],
      [2, 2],
    ])
  })
})
