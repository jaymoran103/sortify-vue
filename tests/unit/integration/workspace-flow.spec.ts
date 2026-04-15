/**
 * Integration test: dashboard → workspace flow
 * Simulates: CSV import → playlists exist → create session → load session data
 *
 * Note: placed in tests/unit/integration/ so Vitest picks it up via the
 * `tests/unit/**` glob in vitest.config.ts (the spec path `tests/integration/`
 * is not included in the current Vitest configuration).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlaylistStore } from '@/stores/playlists'
import { useTrackStore } from '@/stores/tracks'
import { useSessionStore } from '@/stores/sessions'
import { db } from '@/db'

describe('Workspace flow integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
    await db.workspaceSessions.clear()
  })

  it('creates a session from selected playlists and loads tracks correctly', async () => {
    const trackStore = useTrackStore()
    const playlistStore = usePlaylistStore()
    const sessionStore = useSessionStore()

    // Simulate CSV import: add tracks
    await trackStore.addTracks([
      { trackID: 'track-1', title: 'Song A', artist: 'Artist 1', album: 'Album X', source: 'csv' },
      { trackID: 'track-2', title: 'Song B', artist: 'Artist 2', album: 'Album Y', source: 'csv' },
      { trackID: 'track-3', title: 'Song C', artist: 'Artist 3', album: 'Album Z', source: 'csv' },
    ])

    // Simulate CSV import: add playlists
    const pl1Id = await playlistStore.addPlaylist({ name: 'Morning Mix', trackIDs: ['track-1', 'track-2'] })
    const pl2Id = await playlistStore.addPlaylist({ name: 'Evening Chill', trackIDs: ['track-2', 'track-3'] })

    // Playlists appear in library
    const pl1 = await playlistStore.getPlaylist(pl1Id)
    const pl2 = await playlistStore.getPlaylist(pl2Id)
    expect(pl1?.name).toBe('Morning Mix')
    expect(pl2?.name).toBe('Evening Chill')

    // User selects both playlists → creates session
    const sessionId = await sessionStore.createSession([pl1Id, pl2Id])
    expect(typeof sessionId).toBe('number')
    expect(sessionId).toBeGreaterThan(0)

    // Navigate to workspace: load session
    const session = await sessionStore.getSession(sessionId)
    expect(session).toBeDefined()
    expect(session?.playlistIds).toEqual([pl1Id, pl2Id])

    // Load playlists for session
    const loadedPlaylists = []
    for (const id of session!.playlistIds) {
      const pl = await playlistStore.getPlaylist(id)
      if (pl) loadedPlaylists.push(pl)
    }
    expect(loadedPlaylists).toHaveLength(2)
    expect(loadedPlaylists.map((p) => p.name)).toContain('Morning Mix')
    expect(loadedPlaylists.map((p) => p.name)).toContain('Evening Chill')

    // Collect unique track IDs across all loaded playlists
    const trackIdSet = new Set<string>()
    for (const pl of loadedPlaylists) {
      for (const tid of pl.trackIDs) trackIdSet.add(tid)
    }
    expect(trackIdSet.size).toBe(3) // track-1, track-2, track-3

    // Load tracks by IDs
    const loadedTracks = await trackStore.getTracksByIds([...trackIdSet])
    expect(loadedTracks).toHaveLength(3)
    const titles = loadedTracks.map((t) => t.title)
    expect(titles).toContain('Song A')
    expect(titles).toContain('Song B')
    expect(titles).toContain('Song C')

    // Verify playlist membership (what checkboxes would show)
    const morningMix = loadedPlaylists.find((p) => p.name === 'Morning Mix')!
    expect(morningMix.trackIDs).toContain('track-1')
    expect(morningMix.trackIDs).not.toContain('track-3')

    const eveningChill = loadedPlaylists.find((p) => p.name === 'Evening Chill')!
    expect(eveningChill.trackIDs).toContain('track-3')
    expect(eveningChill.trackIDs).not.toContain('track-1')
  })
})
