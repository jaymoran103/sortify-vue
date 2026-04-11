export type TrackSource = 'spotify' | 'csv' | 'json' | 'generated' | 'unknown'

export interface Track {

  //Core properties: title/artist/album are required, trackID and source determined upon import.
  trackID: string
  title: string
  artist: string
  album: string
  source: TrackSource

  //Optional metadata fields
  spotifyURI?: string
  duration?: number
  genre?: string
  bpm?: number
  energy?: number
  [key: string]: unknown
}

export interface Playlist {
  id?: number             // auto-incremented by Dexie
  name: string
  trackIDs: string[]
  playlistURI?: string
  timeAdded?: number        // Date.now() when track was added to playlist
  lastModified?: number     // Date.now() when playlist was last modified (tracks added/removed)
}

export interface WorkspaceSession {
  id?: number                // auto-incremented by Dexie
  name?: string              // optional user label, auto-generated if absent
  playlistIds: number[]      // references to library playlist IDs
  createdAt: number          // Date.now() at creation
  lastOpened: number         // Date.now(), updated on each load
}
