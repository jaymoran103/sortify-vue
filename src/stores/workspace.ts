import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useSessionStore } from '@/stores/sessions'
import { usePlaylistStore } from '@/stores/playlists'
import { useTrackStore } from '@/stores/tracks'
import type { Track, WorkspacePlaylist, PlaylistId } from '@/types/models'

export const useWorkspaceStore = defineStore('workspace', () => {
  const sessionId = ref<number | null>(null)
  const sessionName = ref<string>('')
  const playlists = ref<WorkspacePlaylist[]>([])
  const tracks = ref<Map<string, Track>>(new Map())
  // Tracks which playlist IDs have unsaved in-memory changes (renames, track toggles).
  // Library playlists use their numeric IDB key; workspace-created playlists use their "pending-N" string.
  // addPlaylist/removePlaylist are excluded — those sync to IDB immediately.
  const modifiedIds = ref<Set<PlaylistId>>(new Set())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Monotonically increasing counter for pending playlist IDs within a session.
  // Reset on $reset() so new sessions always start at pending-1.
  const pendingCounter = ref(0)

  // Flat, deduplicated track list in first-seen order (stable display order).
  // Iterates playlists in order, yielding each trackID only the first time it appears.
  const trackList = computed<Track[]>(() => {
    const seen = new Set<string>()
    const result: Track[] = []
    for (const pl of playlists.value) {
      for (const tid of pl.trackIDs) {
        if (!seen.has(tid)) {
          seen.add(tid)
          const track = tracks.value.get(tid)
          if (track) result.push(track)
        }
      }
    }
    return result
  })

  const hasUnsavedChanges = computed(() => modifiedIds.value.size > 0)

  /**
   * Load a workspace session by ID. Clears any currently loaded session first.
   * Validates the ID, fetches session + playlists + tracks from IDB, and touches lastOpened.
   * Sets error on invalid ID, missing session, or unexpected failure.
   */
  async function loadSession(id: number): Promise<void> {
    // Wipe previous session state before loading, including the pending counter.
    $reset()
    isLoading.value = true

    if (!id || !Number.isFinite(id)) {
      error.value = 'No session specified. Go back to the dashboard and select playlists.'
      isLoading.value = false
      return
    }

    try {
      const sessionStore = useSessionStore()
      const session = await sessionStore.getSession(id)
      if (!session) {
        error.value = 'Session not found.'
        return
      }

      const playlistStore = usePlaylistStore()
      const trackStore = useTrackStore()

      // Load playlists. Build trackIdSet per playlist for O(1) membership checks.
      const loadedPlaylists: WorkspacePlaylist[] = []
      for (const plId of session.playlistIds) {
        const pl = await playlistStore.getPlaylist(plId)
        if (pl) {
          loadedPlaylists.push({
            ...pl,
            id: pl.id as number,                 // always present for IDB-sourced playlists
            trackIDs: [...pl.trackIDs],           // clone — mutations must not affect library records
            trackIdSet: new Set(pl.trackIDs),
            origin: 'library',
          })
        }
      }

      // Collect unique track IDs across all loaded playlists to minimize DB queries
      const allTrackIds = new Set<string>()
      for (const pl of loadedPlaylists) {
        for (const tid of pl.trackIDs) allTrackIds.add(tid)
      }

      const loadedTracks = await trackStore.getTracksByIds([...allTrackIds])
      const tracksMap = new Map<string, Track>()
      for (const track of loadedTracks) {
        tracksMap.set(track.trackID, track)
      }

      // Touch session to update lastOpened timestamp (best-effort; don't fail load on error)
      await sessionStore.touchSession(id)

      sessionId.value = id
      sessionName.value = session.name ?? ''
      playlists.value = loadedPlaylists
      tracks.value = tracksMap
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load session.'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Add a library playlist to the current workspace session.
   * Fetches novel tracks (not already in the tracks Map).
   * Syncs the updated playlistIds to the IDB session record.
   * No-op if the playlist is already loaded.
   */
  async function addPlaylist(id: number): Promise<void> {
    const playlistStore = usePlaylistStore()
    const trackStore = useTrackStore()

    const pl = await playlistStore.getPlaylist(id)
    if (!pl) return

    // No-op if already in session
    if (playlists.value.some((p) => p.id === id)) return

    const workspacePl: WorkspacePlaylist = {
      ...pl,
      id: pl.id as number,                       // always present for IDB-sourced playlists
      trackIDs: [...pl.trackIDs],
      trackIdSet: new Set(pl.trackIDs),
      origin: 'library',
    }
    playlists.value = [...playlists.value, workspacePl]

    // Fetch novel tracks (not already in tracks Map)
    const novelIds = pl.trackIDs.filter((tid) => !tracks.value.has(tid))
    if (novelIds.length > 0) {
      const newTracks = await trackStore.getTracksByIds(novelIds)
      const newMap = new Map(tracks.value)
      for (const track of newTracks) {
        newMap.set(track.trackID, track)
      }
      tracks.value = newMap
    }

    // Sync session playlistIds to IDB, derived from current in-memory state to avoid read-modify-write races when addPlaylist is called concurrently.
    if (sessionId.value !== null) {
      const sessionStore = useSessionStore()
      const libraryIds = playlists.value
        .filter((p) => p.origin === 'library')
        .map((p) => p.id as number)
      await sessionStore.updateSession(sessionId.value, { playlistIds: libraryIds })
    }
  }

  /**
   * Remove a playlist from the current workspace session.
   * Works for both library (numeric ID) and workspace-created (pending string ID) playlists.
   * Only library playlists require an IDB session record update (fire-and-forget).
   */
  function removePlaylist(playlistId: PlaylistId): void {
    playlists.value = playlists.value.filter((p) => p.id !== playlistId)
    modifiedIds.value.delete(playlistId)

    // Only library playlists have numeric IDs tracked in the IDB session record.
    // Pending playlists were never persisted to IDB so no update is needed.
    if (sessionId.value !== null && typeof playlistId === 'number') {
      const sessionStore = useSessionStore()
      const currentSessionId = sessionId.value
      const libraryIds = playlists.value
        .filter((p) => p.origin === 'library')
        .map((p) => p.id as number)
      void sessionStore.updateSession(currentSessionId, { playlistIds: libraryIds })
    }
  }

  /**
   * Rename a playlist in the workspace buffer.
   * Does not affect the original library playlist name until save().
   * Marks the playlist as modified for dirty tracking.
   * Works for both library and workspace-created playlists.
   */
  function renamePlaylist(playlistId: PlaylistId, newName: string): void {
    const pl = playlists.value.find((p) => p.id === playlistId)
    if (!pl) return
    pl.name = newName
    modifiedIds.value.add(playlistId)
  }

  /**
   * Duplicate a playlist in the workspace buffer.
   * The copy gets a temporary "pending-N" string ID and origin 'workspace-created'.
   * Works on both library and workspace-created source playlists.
   * FUTURE: save() will write it to IDB and replace the pending ID with a real number.
   */
  function duplicatePlaylist(playlistId: PlaylistId): WorkspacePlaylist {
    const source = playlists.value.find((p) => p.id === playlistId)
    if (!source) throw new Error(`Playlist ${String(playlistId)} not found`)

    pendingCounter.value++
    const pendingId = `pending-${pendingCounter.value}`

    const copy: WorkspacePlaylist = {
      ...source,
      id: pendingId,
      name: `${source.name} (copy)`,
      trackIDs: [...source.trackIDs],
      trackIdSet: new Set(source.trackIdSet),    // independent set for membership tracking
      origin: 'workspace-created',
    }
    playlists.value = [...playlists.value, copy]
    modifiedIds.value.add(pendingId)
    return copy
  }

  /**
   * Create a new empty playlist in the workspace buffer with a temporary pending ID.
   * FUTURE: save() will write it to IDB and replace the pending ID with a real number.
   */
  function createEmptyPlaylist(name: string): WorkspacePlaylist {
    pendingCounter.value++
    const pendingId = `pending-${pendingCounter.value}`

    const newPl: WorkspacePlaylist = {
      id: pendingId,
      name,
      trackIDs: [],
      trackIdSet: new Set(),
      origin: 'workspace-created',
    }
    playlists.value = [...playlists.value, newPl]
    modifiedIds.value.add(pendingId)
    return newPl
  }

  // TODO Stub Method
  function toggleTrack(playlistId: PlaylistId, trackId: string): void {
    console.log('workspace.toggleTrack stub: ', playlistId, trackId)
  }

  // TODO Stub Method
  async function save(): Promise<void> {
    console.log('workspace.save() stub: not yet implemented')
  }

  /**
   * Reset all workspace state to initial values.
   * Called when the user closes the workspace or navigates away (onBeforeUnmount in WorkspaceView).
   * Also called at the start of loadSession to prevent stale data from a previous session.
   */
  function $reset(): void {
    sessionId.value = null
    sessionName.value = ''
    playlists.value = []
    tracks.value = new Map()
    modifiedIds.value = new Set()
    isLoading.value = false
    error.value = null
    pendingCounter.value = 0
  }

  return {
    sessionId,
    sessionName,
    playlists,
    tracks,
    modifiedIds,
    isLoading,
    error,
    trackList,
    hasUnsavedChanges,
    loadSession,
    addPlaylist,
    removePlaylist,
    renamePlaylist,
    duplicatePlaylist,
    createEmptyPlaylist,
    toggleTrack,
    save,
    $reset,
  }
})
