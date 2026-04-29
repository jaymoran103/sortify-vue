import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlaylistStore } from '@/stores/playlists'
import { db } from '@/db'

/**
 * Playlist Store Tests
 * Note: Tests assume that the database is cleared after each test to ensure isolation. 
 * Deleting database is avoided to prevent closing the singleton instance, which causes later tests to fail.
 */
describe('Playlist Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await db.playlists.clear()
  })

  it('addPlaylist returns auto-generated id', async () => {
    const store = usePlaylistStore()
    const playlist = {
      name: 'My Playlist',
      trackIDs: ['track-1'],
    }

    const id = await store.addPlaylist(playlist)
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('addPlaylist stores playlist with trackIDs array', async () => {
    const store = usePlaylistStore()
    const playlist = {
      name: 'My Playlist',
      trackIDs: ['track-1', 'track-2'],
    }

    const id = await store.addPlaylist(playlist)
    const retrieved = await store.getPlaylist(id)

    expect(retrieved?.trackIDs).toEqual(['track-1', 'track-2'])
  })

  it('addPlaylist sets lastModified timestamp', async () => {
    const store = usePlaylistStore()
    const before = Date.now()

    const playlist = {
      name: 'My Playlist',
      trackIDs: [],
    }

    const id = await store.addPlaylist(playlist)
    const added = await store.getPlaylist(id)

    const after = Date.now()

    expect(added?.lastModified).toBeGreaterThanOrEqual(before)
    expect(added?.lastModified).toBeLessThanOrEqual(after)
  })

  it('updatePlaylist modifies only specified fields', async () => {
    const store = usePlaylistStore()
    const originalPlaylist = {
      name: 'Original',
      trackIDs: ['track-1'],
    }

    const id = await store.addPlaylist(originalPlaylist)
    await store.updatePlaylist(id, { name: 'Updated' })

    const updated = await store.getPlaylist(id)
    expect(updated?.name).toBe('Updated')
    expect(updated?.trackIDs).toEqual(['track-1'])
  })

  it('updatePlaylist preserves unmodified fields', async () => {
    const store = usePlaylistStore()
    const playlist = {
      name: 'Playlist',
      trackIDs: ['track-1', 'track-2'],
      playlistURI: 'spotify:playlist:123',
    }

    const id = await store.addPlaylist(playlist)
    await store.updatePlaylist(id, { name: 'Renamed' })

    const updated = await store.getPlaylist(id)
    expect(updated?.playlistURI).toBe('spotify:playlist:123')
  })

  it('updatePlaylist updates lastModified timestamp', async () => {
    const store = usePlaylistStore()
    const playlist = {
      name: 'Playlist',
      trackIDs: [],
    }

    const id = await store.addPlaylist(playlist)
    const firstModified = (await store.getPlaylist(id))?.lastModified

    await new Promise((resolve) => setTimeout(resolve, 10))
    await store.updatePlaylist(id, { name: 'Renamed' })

    const secondModified = (await store.getPlaylist(id))?.lastModified

    expect(secondModified).toBeGreaterThan(firstModified || 0)
  })

  it('getPlaylist returns playlist for valid id', async () => {
    const store = usePlaylistStore()
    const playlist = {
      name: 'Test',
      trackIDs: ['track-1'],
    }

    const id = await store.addPlaylist(playlist)
    const retrieved = await store.getPlaylist(id)

    expect(retrieved?.name).toBe('Test')
  })

  it('getPlaylist returns undefined for invalid id', async () => {
    const store = usePlaylistStore()
    const retrieved = await store.getPlaylist(999)

    expect(retrieved).toBeUndefined()
  })

  it('deletePlaylist removes playlist from database', async () => {
    const store = usePlaylistStore()
    const playlist = {
      name: 'Playlist',
      trackIDs: [],
    }

    const id = await store.addPlaylist(playlist)
    await store.deletePlaylist(id)
    const retrieved = await store.getPlaylist(id)

    expect(retrieved).toBeUndefined()
  })

  it('deletePlaylists removes multiple playlists', async () => {
    const store = usePlaylistStore()
    const playlist = {
      name: 'Playlist',
      trackIDs: [],
    }

    const id1 = await store.addPlaylist(playlist)
    const id2 = await store.addPlaylist(playlist)

    await store.deletePlaylists([id1, id2])

    const count = await db.playlists.count()
    expect(count).toBe(0)
  })

  it('clearPlaylists removes all playlists', async () => {
    const store = usePlaylistStore()
    const playlist = {
      name: 'Playlist',
      trackIDs: [],
    }

    await store.addPlaylist(playlist)
    await store.addPlaylist(playlist)

    await store.clearPlaylists()

    const count = await db.playlists.count()
    expect(count).toBe(0)
  })
})

// These tests verify that the full reactive chain works with fake-indexeddb: 
// Dexie write -> liveQuery fires -> playlists ref updates -> downstream computed

describe('Playlist Store — liveQuery integration', () => {
  // Polls at 20 ms intervals until predicate is true or timeout expires.
  // Needed because Dexie's liveQuery fires asynchronously after IDB commits.
  async function waitFor(
    predicate: () => boolean,
    timeoutMs = 2000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error('waitFor timed out')
      // Flush pending microtasks (Dexie uses Promise chains internally)
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await db.playlists.clear()
  })

  it('playlists ref updates reactively after addPlaylist', async () => {
    const store = usePlaylistStore()

    // Wait for initial liveQuery emission (empty array from DB)
    await waitFor(() => Array.isArray(store.playlists))

    await store.addPlaylist({ name: 'Reactive PL', trackIDs: [] })

    // liveQuery fires asynchronously after the IDB transaction commits
    await waitFor(() => (store.playlists?.length ?? 0) > 0)

    expect(store.playlists?.some((p) => p.name === 'Reactive PL')).toBe(true)
  })

  it('playlists ref updates reactively after batchUpdatePlaylists', async () => {
    const store = usePlaylistStore()

    await waitFor(() => Array.isArray(store.playlists))

    const id = await store.addPlaylist({ name: 'Before Update', trackIDs: ['t1'] })
    await waitFor(() => (store.playlists?.length ?? 0) > 0)

    // batchUpdatePlaylists is the write path used by workspace save()
    await store.batchUpdatePlaylists([
      { id, changes: { name: 'After Update', trackIDs: ['t1', 't2'] } },
    ])

    await waitFor(() => store.playlists?.some((p) => p.name === 'After Update') ?? false)

    const updated = store.playlists?.find((p) => p.id === id)
    expect(updated?.name).toBe('After Update')
    expect(updated?.trackIDs).toEqual(['t1', 't2'])
  })

  it('downstream computed re-evaluates after liveQuery fires', async () => {
    const store = usePlaylistStore()

    await waitFor(() => Array.isArray(store.playlists))
    expect(store.playlistCount).toBe(0)

    await store.addPlaylist({ name: 'PL A', trackIDs: ['t1', 't2'] })
    await store.addPlaylist({ name: 'PL B', trackIDs: ['t3'] })

    await waitFor(() => store.playlistCount === 2)

    expect(store.playlistCount).toBe(2)
  })
})
