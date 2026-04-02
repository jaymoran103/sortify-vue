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
