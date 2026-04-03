import { describe, it, expect } from 'vitest'
import { buildJsonBundle } from '@/adapters/jsonExport'
import type { Track, Playlist } from '@/types/models'

const track: Track = { trackID: 't1', title: 'Song', artist: 'Artist', album: 'Album', source: 'csv' }
const playlist: Playlist = { id: 1, name: 'PL', trackIDs: ['t1'] }

describe('jsonExport', () => {
  it('exports all tracks and playlists as JSON bundle', () => {
    const bundle = buildJsonBundle([track], [playlist])
    expect(bundle.tracks).toHaveLength(1)
    expect(bundle.playlists).toHaveLength(1)
    expect(bundle.tracks[0].trackID).toBe('t1')
  })

  it('includes exportedAt timestamp', () => {
    const bundle = buildJsonBundle([track], [playlist])
    expect(bundle.exportedAt).toBeDefined()
    expect(typeof bundle.exportedAt).toBe('string')
    expect(new Date(bundle.exportedAt).getTime()).not.toBeNaN()
  })

  it('output is valid JSON', () => {
    const bundle = buildJsonBundle([track], [playlist])
    const json = JSON.stringify(bundle)
    expect(() => JSON.parse(json)).not.toThrow()
    const parsed = JSON.parse(json) as { tracks: unknown[]; playlists: unknown[] }
    expect(parsed.tracks).toHaveLength(1)
    expect(parsed.playlists).toHaveLength(1)
  })
})
