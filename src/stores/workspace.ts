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

  // Stable, first-seen arrival order for all tracks in the workspace.
  // Established once on session load; updated only when the track set changes:
  //   - addPlaylist appends novel track IDs
  //   - removeTrackFromWorkspace removes specific IDs
  // toggleTrack should NOT affect this — membership changes don't reorder or hide tracks.
  const stableOrder = ref<string[]>([])

  // Flat track list in stable arrival order — derived from stableOrder, not from playlist trackIDs.
  // This means toggleTrack cannot cause reordering or track disappearance from the view.
  // A track only leaves trackList when explicitly removed from the workspace.
  const trackList = computed<Track[]>(() =>
    stableOrder.value
      .map((id) => tracks.value.get(id))
      .filter((t): t is Track => t !== undefined),
  )

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

      // Collect unique track IDs in first-seen order to establish stable display order.
      // This ordered array is the base reference for display, sort, and filter: updated only when tracks are added/removed from the workspace, not on toggleTrack.
      const stableIds: string[] = []
      const seenIds = new Set<string>()
      // For each loaded playlist in order,
      for (const pl of loadedPlaylists) {
        // Iterate trackIDs in order, adding novel IDs to the stable list and seen set.
        for (const tid of pl.trackIDs) {
          if (!seenIds.has(tid)) {
            seenIds.add(tid)
            stableIds.push(tid)
          }
        }
      }

      const loadedTracks = await trackStore.getTracksByIds(stableIds)
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
      stableOrder.value = stableIds
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

    // Extend stable display order with any track IDs novel to this playlist.
    // Checked against stableOrder (not tracks.value) to be robust against any edge cases.
    const currentOrderSet = new Set(stableOrder.value)
    const novelOrderIds = workspacePl.trackIDs.filter((tid) => !currentOrderSet.has(tid))
    if (novelOrderIds.length > 0) {
      stableOrder.value = [...stableOrder.value, ...novelOrderIds]
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
   * Swap a playlist one position left (-1) or right (+1) in the current column order.
   * No-op if already at the boundary or the playlist is not found.
   */
  function movePlaylist(playlistId: PlaylistId, direction: -1 | 1): void {
    const idx = playlists.value.findIndex((p) => p.id === playlistId)

    // Exit early if playlist not found. This should not happen in normal operation since move controls are only rendered for existing playlists;.
    if (idx === -1) return
    const newIdx = idx + direction

    // exit early if new index is out of bounds (already at leftmost or rightmost position)
    if (newIdx < 0 || newIdx >= playlists.value.length) return

    // Swap the two playlists in the array, mark both as modified for dirty tracking.
    const arr = [...playlists.value]
    const temp = arr[idx]!
    arr[idx] = arr[newIdx]!
    arr[newIdx] = temp
    playlists.value = arr
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

  /**
   * Add a track to every playlist in the workspace that does not already contain it.
   * Marks each affected playlist as modified.
   */
  function addTrackToAll(trackId: string): void {
    for (const pl of playlists.value) {
      if (!pl.trackIdSet.has(trackId)) {
        pl.trackIDs.push(trackId)
        pl.trackIdSet.add(trackId)
        modifiedIds.value.add(pl.id!)
      }
    }
  }

  /**
   * Remove a track from every playlist in the workspace that contains it, marking each affected playlist as modified. 
   * Does NOT remove the track from the workspace track map or stable order — use removeTrackFromWorkspace for that.
   * 
   * Serves as helper for removeTrackFromWorkspace action.
   */
  function removeTrackFromAll(trackId: string): void {
    for (const pl of playlists.value) {
      if (pl.trackIdSet.has(trackId)) {
        pl.trackIDs = pl.trackIDs.filter((id) => id !== trackId)
        pl.trackIdSet.delete(trackId)
        modifiedIds.value.add(pl.id!)
      }
    }
  }

  /**
   * Remove a track from all playlists, from the workspace track map, and from the stable display order.
   * The track row disappears from the workspace table.
   */
  function removeTrackFromWorkspace(trackId: string): void {
    removeTrackFromAll(trackId)
    tracks.value.delete(trackId)
    stableOrder.value = stableOrder.value.filter((id) => id !== trackId)
  }

  /**
   * Bulk version of addTrackToAll — operates on a set of track IDs.
   */
  function bulkAddToAll(trackIds: Set<string>): void {
    for (const tid of trackIds) addTrackToAll(tid)
  }

  /**
   * Bulk version of removeTrackFromAll — operates on a set of track IDs.
   */
  function bulkRemoveFromAll(trackIds: Set<string>): void {
    for (const tid of trackIds) removeTrackFromAll(tid)
  }

  /**
   * Remove multiple tracks from all playlists, from the workspace track map, and
   * from the stable display order in a single stableOrder filter pass (O(n+m)).
   */
  function bulkRemoveFromWorkspace(trackIds: Set<string>): void {
    for (const tid of trackIds) {
      removeTrackFromAll(tid)
      tracks.value.delete(tid)
    }
    stableOrder.value = stableOrder.value.filter((id) => !trackIds.has(id))
  }

  /**
   * Toggle a track's membership in a playlist. 
   * 
   * Keeps trackIDs in sync within playlist lookup set and ordered array.
   * Marks the playlist as modified for dirty tracking.
   * Works for both library and workspace-created (pending) playlists.
   */
  function toggleTrack(playlistId: PlaylistId, trackId: string): void {
    const playlist = playlists.value.find((p) => p.id === playlistId)
    if (!playlist) return

    if (playlist.trackIdSet.has(trackId)) {
      // Remove: update both array and set
      playlist.trackIDs = playlist.trackIDs.filter((id) => id !== trackId)
      playlist.trackIdSet.delete(trackId)
    } else {
      // Add: update both array and set
      playlist.trackIDs.push(trackId)
      playlist.trackIdSet.add(trackId)
    }

    modifiedIds.value.add(playlist.id)
  }

  /**
   * Persist all in-memory changes back to IDB .No-op if there are no unsaved changes.
   * 
   * Steps:
   * 1. Revolve pending workspace-created playlists. Write as new IDB records, patching "pending-N" IDs to real auto-increment numbers.
   * 2. Update modified library playlists in IDB (via playlistStore).
   * 3. Update session record to reflect current playlist IDs (all numeric, corresponding to IDB)
   * 4. modifiedIds is cleared.
   */
  async function save(): Promise<void> {
    // Exit early if no changes to save
    if (!hasUnsavedChanges.value) return

    const playlistStore = usePlaylistStore()
    const sessionStore = useSessionStore()

    // Step 1: resolve pending playlists (write to IDB, patch IDs)
    for (const pl of playlists.value) {
      if (typeof pl.id === 'string') {

        // Strip workspace-only fields and the temp id before writing to IDB
        const { trackIdSet: _set, origin: _origin, id: _tempId, ...rest } = pl

        // Clone the trackIDs array to ensure the Proxy is unwrapped before IDB write
        const forDb: Omit<WorkspacePlaylist, 'id' | 'trackIdSet' | 'origin'> = {
          ...rest,
          trackIDs: [...pl.trackIDs],
        }
        const realId = await playlistStore.addPlaylist(forDb)

        // Patch the in-memory object with the real persistent ID
        const oldId = pl.id
        pl.id = realId
        modifiedIds.value.delete(oldId)
        // freshly written, no need to add to modifiedIds
      }
    }

    // Step 2: update modified library playlists in a single batched transaction.
    const batchUpdates: Array<{ id: number; changes: { name: string; trackIDs: string[] } }> = []
    for (const modId of modifiedIds.value) {
      // After pending resolution above, only numeric IDs remain in modifiedIds
      const pl = playlists.value.find((p) => p.id === modId)
      if (!pl) continue
      batchUpdates.push({ id: pl.id as number, changes: { name: pl.name, trackIDs: [...pl.trackIDs] } })
    }
    await playlistStore.batchUpdatePlaylists(batchUpdates)

    // Step 3: update session record with current (now all-numeric) playlist IDs
    if (sessionId.value !== null) {
      await sessionStore.updateSession(sessionId.value, {
        playlistIds: playlists.value
          .filter((p) => typeof p.id === 'number')
          .map((p) => p.id as number),
      })
    }

    modifiedIds.value.clear()
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
    stableOrder.value = []
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
    movePlaylist,
    createEmptyPlaylist,
    addTrackToAll,
    removeTrackFromAll,
    removeTrackFromWorkspace,
    bulkAddToAll,
    bulkRemoveFromAll,
    bulkRemoveFromWorkspace,
    toggleTrack,
    save,
    $reset,
  }
})
