import { computed } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db'
import { useLiveQuery } from '@/composables/useLiveQuery'
import type { Playlist } from '@/types/models'

/**
 * Playlist Store: Manages playlist data with auto-generated numeric IDs, ensuring trackIDs are stored as arrays and lastModified timestamps are updated on changes.
 */
export const usePlaylistStore = defineStore('playlists', () => {

  // Live query to reactively fetch all playlists from the database
  const playlists = useLiveQuery(() => db.playlists.toArray(), [])

  /** Fetches a playlist by its numeric ID.*/
  async function getPlaylist(id: number): Promise<Playlist | undefined> {
    return db.playlists.get(id)
  }


  /** adds a new playlist to the database, */
  async function addPlaylist(
    playlist: Omit<Playlist, 'id'>,
  ): Promise<number> {

    const now = Date.now()
    const id = await db.playlists.add({
      ...playlist,
      lastModified: now,
    })
    return id as number
  }

  /** Updates an existing playlist in the database. */
  async function updatePlaylist(
    id: number,
    changes: Partial<Playlist>,
  ): Promise<void> {
    await db.playlists.update(id, {
      ...changes,
      lastModified: Date.now(),
    })
  }

  /** Deletes a playlist from the database by its numeric ID. */
  async function deletePlaylist(id: number): Promise<void> {
    await db.playlists.delete(id)
  }

  /** Deletes multiple playlists from the database by their numeric IDs. */
  async function deletePlaylists(ids: number[]): Promise<void> {
    await db.playlists.bulkDelete(ids)
  }

  /** Clears all playlists from the database. 
   * FUTURE: Any ui feature down the road that calls this should ask for confirmation first
   */ 
  async function clearPlaylists(): Promise<void> {
    await db.playlists.clear()
  }

  // Helper method computes the total number of playlists, ensuring it returns 0 if the data is not yet available or is in an unexpected format.
  const playlistCount = computed(() => {
    const arr = playlists.value
    return Array.isArray(arr) ? arr.length : 0
  })

  return {
    playlists,
    getPlaylist,
    addPlaylist,
    updatePlaylist,
    deletePlaylist,
    deletePlaylists,
    clearPlaylists,
    playlistCount,
  }
})
