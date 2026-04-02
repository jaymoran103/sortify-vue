import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTrackStore } from '@/stores/tracks'
import { db } from '@/db'
import type { Track } from '@/types/models'

/**
 * Track Store Tests
 * Note: Tests assume that the database is cleared after each test to ensure isolation. Avoiding database deletion to prevent future issues with closed singleton instance.
 */
describe('Track Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await db.tracks.clear()
  })

  it('addTrack stores and retrieves a track', async () => {
    const store = useTrackStore()
    const track: Track = {
      trackID: 'track-1',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      source: 'csv',
    }

    const id = await store.addTrack(track)
    const retrieved = await store.getTrack(id)

    expect(id).toBe('track-1')
    expect(retrieved).toEqual(track)
  })

  it('addTrack with duplicate trackID overwrites existing', async () => {
    const store = useTrackStore()
    const track1: Track = {
      trackID: 'track-1',
      title: 'Original',
      artist: 'Artist',
      album: 'Album',
      source: 'csv',
    }

    const track2: Track = {
      trackID: 'track-1',
      title: 'Updated',
      artist: 'Artist',
      album: 'Album',
      source: 'csv',
    }

    await store.addTrack(track1)
    await store.addTrack(track2)

    const retrieved = await store.getTrack('track-1')
    expect(retrieved?.title).toBe('Updated')
  })

  it('addTracks bulk inserts multiple tracks', async () => {
    const store = useTrackStore()
    const tracks: Track[] = [
      {
        trackID: 'track-1',
        title: 'Song 1',
        artist: 'Artist',
        album: 'Album',
        source: 'csv',
      },
      {
        trackID: 'track-2',
        title: 'Song 2',
        artist: 'Artist',
        album: 'Album',
        source: 'csv',
      },
    ]

    await store.addTracks(tracks)
    const retrieved1 = await store.getTrack('track-1')
    const retrieved2 = await store.getTrack('track-2')

    expect(retrieved1).toEqual(tracks[0])
    expect(retrieved2).toEqual(tracks[1])
  })

  it('getTrack returns track for valid ID', async () => {
    const store = useTrackStore()
    const track: Track = {
      trackID: 'track-1',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      source: 'csv',
    }

    await store.addTrack(track)
    const retrieved = await store.getTrack('track-1')

    expect(retrieved).toEqual(track)
  })

  it('getTrack returns undefined for nonexistent ID', async () => {
    const store = useTrackStore()
    const retrieved = await store.getTrack('nonexistent')

    expect(retrieved).toBeUndefined()
  })

  it('getTracksByIds returns only matching tracks', async () => {
    const store = useTrackStore()
    const tracks: Track[] = [
      {
        trackID: 'track-1',
        title: 'Song 1',
        artist: 'Artist',
        album: 'Album',
        source: 'csv',
      },
      {
        trackID: 'track-2',
        title: 'Song 2',
        artist: 'Artist',
        album: 'Album',
        source: 'csv',
      },
    ]

    await store.addTracks(tracks)
    const retrieved = await store.getTracksByIds(['track-1', 'nonexistent'])

    expect(retrieved).toHaveLength(1)
    expect(retrieved[0]?.trackID).toBe('track-1')
  })

  it('deleteTrack removes track from database', async () => {
    const store = useTrackStore()
    const track: Track = {
      trackID: 'track-1',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      source: 'csv',
    }

    await store.addTrack(track)
    await store.deleteTrack('track-1')
    const retrieved = await store.getTrack('track-1')

    expect(retrieved).toBeUndefined()
  })

  it('clearTracks removes all tracks', async () => {
    const store = useTrackStore()
    const tracks: Track[] = [
      {
        trackID: 'track-1',
        title: 'Song 1',
        artist: 'Artist',
        album: 'Album',
        source: 'csv',
      },
      {
        trackID: 'track-2',
        title: 'Song 2',
        artist: 'Artist',
        album: 'Album',
        source: 'csv',
      },
    ]

    await store.addTracks(tracks)
    await store.clearTracks()

    const count = await db.tracks.count()
    expect(count).toBe(0)
  })
})
