import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSessionStore } from '@/stores/sessions'
import { usePlaylistStore } from '@/stores/playlists'
import { useTrackStore } from '@/stores/tracks'
import { db } from '@/db'

describe('Workspace Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await db.tracks.clear()
    await db.playlists.clear()
    await db.workspaceSessions.clear()
  })

  // ─── Helpers ─────────────────────────────────────────────────────────────

  async function setupData() {
    const trackStore = useTrackStore()
    const playlistStore = usePlaylistStore()
    const sessionStore = useSessionStore()

    await trackStore.addTracks([
      { trackID: 'track-1', title: 'Song A', artist: 'Artist 1', album: 'Album 1', source: 'csv' },
      { trackID: 'track-2', title: 'Song B', artist: 'Artist 2', album: 'Album 2', source: 'csv' },
      { trackID: 'track-3', title: 'Song C', artist: 'Artist 3', album: 'Album 3', source: 'csv' },
    ])

    const pl1Id = await playlistStore.addPlaylist({ name: 'Playlist A', trackIDs: ['track-1', 'track-2'] })
    const pl2Id = await playlistStore.addPlaylist({ name: 'Playlist B', trackIDs: ['track-2', 'track-3'] })
    const sessionId = await sessionStore.createSession([pl1Id, pl2Id], 'Test Session')

    return { pl1Id, pl2Id, sessionId }
  }

  // ─── loadSession ──────────────────────────────────────────────────────────

  it('loadSession loads playlists and tracks, sets sessionId and sessionName', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()

    await store.loadSession(sessionId)

    expect(store.sessionId).toBe(sessionId)
    expect(store.sessionName).toBe('Test Session')
    expect(store.playlists).toHaveLength(2)
    expect(store.tracks.size).toBe(3)
  })

  it('loadSession sets isLoading to false after completing', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()

    await store.loadSession(sessionId)

    expect(store.isLoading).toBe(false)
  })

  it('loadSession with invalid ID sets error and leaves sessionId null', async () => {
    const store = useWorkspaceStore()

    await store.loadSession(99999)

    expect(store.error).toBe('Session not found.')
    expect(store.sessionId).toBeNull()
  })

  it('loadSession builds trackIdSet on each WorkspacePlaylist', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()

    await store.loadSession(sessionId)

    const pl = store.playlists.find((p) => p.id === pl1Id)
    expect(pl?.trackIdSet).toBeInstanceOf(Set)
    expect(pl?.trackIdSet.has('track-1')).toBe(true)
    expect(pl?.trackIdSet.has('track-3')).toBe(false)
  })

  // ─── trackList ────────────────────────────────────────────────────────────

  it('trackList returns deduplicated tracks in first-seen order', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()

    await store.loadSession(sessionId)

    // Playlist A has track-1, track-2; Playlist B adds track-3. track-2 appears in both but only once.
    const ids = store.trackList.map((t) => t.trackID)
    expect(ids).toEqual(['track-1', 'track-2', 'track-3'])
  })

  it('trackList is empty before session is loaded', () => {
    const store = useWorkspaceStore()
    expect(store.trackList).toHaveLength(0)
  })

  // ─── addPlaylist ──────────────────────────────────────────────────────────

  it('addPlaylist adds to playlists and fetches novel tracks', async () => {
    const trackStore = useTrackStore()
    const playlistStore = usePlaylistStore()
    const sessionStore = useSessionStore()

    await trackStore.addTracks([
      { trackID: 'track-1', title: 'Song A', artist: 'A1', album: 'Al1', source: 'csv' },
      { trackID: 'track-2', title: 'Song B', artist: 'A2', album: 'Al2', source: 'csv' },
    ])
    const pl1Id = await playlistStore.addPlaylist({ name: 'PL1', trackIDs: ['track-1'] })
    const pl2Id = await playlistStore.addPlaylist({ name: 'PL2', trackIDs: ['track-2'] })
    const sessionId = await sessionStore.createSession([pl1Id])

    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    expect(store.playlists).toHaveLength(1)
    expect(store.tracks.size).toBe(1)

    await store.addPlaylist(pl2Id)

    expect(store.playlists).toHaveLength(2)
    expect(store.tracks.size).toBe(2)
  })

  it('addPlaylist is a no-op when playlist is already in session', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    const countBefore = store.playlists.length
    await store.addPlaylist(pl1Id)

    expect(store.playlists).toHaveLength(countBefore)
  })

  // ─── removePlaylist ───────────────────────────────────────────────────────

  it('removePlaylist removes from playlists array', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    store.removePlaylist(pl1Id)

    expect(store.playlists).toHaveLength(1)
    expect(store.playlists[0]?.name).toBe('Playlist B')
  })

  it('removePlaylist removes the playlist id from modifiedIds', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    store.renamePlaylist(pl1Id, 'Temp Name') // adds to modifiedIds
    expect(store.modifiedIds.has(pl1Id)).toBe(true)

    store.removePlaylist(pl1Id)
    expect(store.modifiedIds.has(pl1Id)).toBe(false)
  })

  // ─── renamePlaylist ───────────────────────────────────────────────────────

  it('renamePlaylist updates the playlist name', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    store.renamePlaylist(pl1Id, 'Renamed A')

    const pl = store.playlists.find((p) => p.id === pl1Id)
    expect(pl?.name).toBe('Renamed A')
  })

  it('renamePlaylist adds the playlist id to modifiedIds', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    store.renamePlaylist(pl1Id, 'Renamed A')

    expect(store.modifiedIds.has(pl1Id)).toBe(true)
  })

  // ─── duplicatePlaylist ────────────────────────────────────────────────────

  it('duplicatePlaylist creates a copy with a pending string ID', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    const copy = store.duplicatePlaylist(pl1Id)

    expect(String(copy.id)).toMatch(/^pending-\d+$/)
    expect(copy.name).toContain('(copy)')
    expect(copy.origin).toBe('workspace-created')
  })

  it('duplicatePlaylist adds the copy to playlists', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    store.duplicatePlaylist(pl1Id)

    expect(store.playlists).toHaveLength(3)
  })

  it('duplicatePlaylist adds the pending id to modifiedIds', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    const copy = store.duplicatePlaylist(pl1Id)

    expect(store.modifiedIds.has(String(copy.id))).toBe(true)
  })

  // ─── createEmptyPlaylist ──────────────────────────────────────────────────

  it('createEmptyPlaylist creates a new playlist with a pending ID and no tracks', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    const newPl = store.createEmptyPlaylist('Brand New')

    expect(String(newPl.id)).toMatch(/^pending-\d+$/)
    expect(newPl.trackIDs).toHaveLength(0)
    expect(newPl.trackIdSet.size).toBe(0)
    expect(newPl.origin).toBe('workspace-created')
    expect(store.playlists).toHaveLength(3)
  })

  it('createEmptyPlaylist adds the pending id to modifiedIds', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    const newPl = store.createEmptyPlaylist('Test')

    expect(store.modifiedIds.has(String(newPl.id))).toBe(true)
  })

  // ─── hasUnsavedChanges ────────────────────────────────────────────────────

  it('hasUnsavedChanges is false when no modifications', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    expect(store.hasUnsavedChanges).toBe(false)
  })

  it('hasUnsavedChanges is true after a rename', async () => {
    const { pl1Id, sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    store.renamePlaylist(pl1Id, 'New Name')

    expect(store.hasUnsavedChanges).toBe(true)
  })

  // ─── $reset ───────────────────────────────────────────────────────────────

  it('$reset clears all state', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    expect(store.playlists).toHaveLength(2)

    store.$reset()

    expect(store.sessionId).toBeNull()
    expect(store.sessionName).toBe('')
    expect(store.playlists).toHaveLength(0)
    expect(store.tracks.size).toBe(0)
    expect(store.modifiedIds.size).toBe(0)
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('$reset resets pendingCounter so the next session starts at pending-1', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)
    store.createEmptyPlaylist('First') // pendingCounter → 1

    store.$reset()
    await store.loadSession(sessionId)
    const fresh = store.createEmptyPlaylist('After Reset')

    expect(String(fresh.id)).toBe('pending-1')
  })

  // ─── loadSession edge cases ──────────────────────────────────────────────

  it('loadSession(0) sets error without attempting a DB lookup', async () => {
    const store = useWorkspaceStore()

    await store.loadSession(0)

    expect(store.error).toContain('No session specified')
    expect(store.sessionId).toBeNull()
    expect(store.isLoading).toBe(false)
  })

  it('loadSession(NaN) sets error', async () => {
    const store = useWorkspaceStore()

    await store.loadSession(NaN)

    expect(store.error).toContain('No session specified')
  })

  it('second loadSession call clears previous session state', async () => {
    const trackStore = useTrackStore()
    const playlistStore = usePlaylistStore()
    const sessionStore = useSessionStore()

    await trackStore.addTracks([
      { trackID: 't-a', title: 'A', artist: 'Ar', album: 'Al', source: 'csv' },
      { trackID: 't-b', title: 'B', artist: 'Br', album: 'Bl', source: 'csv' },
    ])
    const pl1 = await playlistStore.addPlaylist({ name: 'PL1', trackIDs: ['t-a'] })
    const pl2 = await playlistStore.addPlaylist({ name: 'PL2', trackIDs: ['t-b'] })
    const session1 = await sessionStore.createSession([pl1], 'Session 1')
    const session2 = await sessionStore.createSession([pl2], 'Session 2')

    const store = useWorkspaceStore()
    await store.loadSession(session1)
    expect(store.sessionName).toBe('Session 1')
    expect(store.playlists[0]?.name).toBe('PL1')

    await store.loadSession(session2)
    expect(store.sessionName).toBe('Session 2')
    expect(store.playlists).toHaveLength(1)
    expect(store.playlists[0]?.name).toBe('PL2')
  })

  // ─── pending playlist operations ─────────────────────────────────────────

  it('renamePlaylist works on a pending (workspace-created) playlist', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    const newPl = store.createEmptyPlaylist('Scratch')
    store.renamePlaylist(newPl.id, 'Renamed Scratch')

    const found = store.playlists.find((p) => p.id === newPl.id)
    expect(found?.name).toBe('Renamed Scratch')
    expect(store.modifiedIds.has(newPl.id)).toBe(true)
  })

  it('removePlaylist works on a pending (workspace-created) playlist', async () => {
    const { sessionId } = await setupData()
    const store = useWorkspaceStore()
    await store.loadSession(sessionId)

    const newPl = store.createEmptyPlaylist('To Remove')
    expect(store.playlists).toHaveLength(3)

    store.removePlaylist(newPl.id)

    expect(store.playlists).toHaveLength(2)
    expect(store.modifiedIds.has(newPl.id)).toBe(false)
  })
})

