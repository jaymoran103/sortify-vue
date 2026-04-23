import { computed } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db'
import { useLiveQuery } from '@/composables/useLiveQuery'
import type { Track } from '@/types/models'

/**
 * Track Store: Manages track data with string-based trackIDs, ensuring bulk operations for efficiency and a computed property for total track count.
 */
export const useTrackStore = defineStore('tracks', () => {
  const tracks = useLiveQuery(() => db.tracks.toArray(), [])

  /** Fetches a track by its string-based trackID. */
  async function getTrack(id: string): Promise<Track | undefined> {
    return db.tracks.get(id)
  }

  /** Fetches multiple tracks by their string-based trackIDs. */
  async function getTracksByIds(ids: string[]): Promise<Track[]> {
    return db.tracks.bulkGet(ids).then((results: Array<Track | undefined>) =>
      results.filter((track): track is Track => track !== undefined),
    )
  }

  /** Adds a new track to the database. */
  async function addTrack(track: Track): Promise<string> {
    await db.tracks.put(track)
    return track.trackID
  }

  /** Adds multiple tracks to the database. */
  async function addTracks(newTracks: Track[]): Promise<void> {
    await db.tracks.bulkPut(newTracks)
  }

  /** Deletes a track from the database by its string-based trackID. */
  async function deleteTrack(id: string): Promise<void> {
    await db.tracks.delete(id)
  }

  /** Deletes multiple tracks from the database by their string-based trackIDs. */
  async function deleteTracks(ids: string[]): Promise<void> {
    await db.tracks.bulkDelete(ids)
  }

  /** Clears all tracks from the database. */
  async function clearTracks(): Promise<void> {
    await db.tracks.clear()
  }

  // Helper method computes the total number of tracks, ensuring it returns 0 if the data is not yet available or is in an unexpected format.
  const trackCount = computed(() => {
    const arr = tracks.value
    return Array.isArray(arr) ? arr.length : 0
  })

  return {
    tracks,
    getTrack,
    getTracksByIds,
    addTrack,
    addTracks,
    deleteTrack,
    deleteTracks,
    clearTracks,
    trackCount,
  }
})
