export type TrackSource = 'spotify' | 'csv' | 'json' | 'generated' | 'unknown'
// Basic track structure used across modules. Requires core properties, with some optional fields for future use.
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

// Basic playlist structure used in the library and workspace, with some optional fields for future use. 
export interface Playlist {
  id?: number             // auto-incremented by Dexie
  name: string
  trackIDs: string[]
  playlistURI?: string
  timeAdded?: number        // Date.now() when track was added to playlist
  lastModified?: number     // Date.now() when playlist was last modified (tracks added/removed)
}

export type PlaylistId = number | string

// WorkspacePlaylist extends Playlist with additional fields for workspace management.
export interface WorkspacePlaylist extends Omit<Playlist, 'id'> {
  id: PlaylistId
  trackIdSet: Set<string>
  origin: 'library' | 'workspace-created'
}

// Session structure for saving/loading sets of playlists in the workspace.
export interface WorkspaceSession {
  id?: number                // auto-incremented by Dexie
  name?: string              // optional user label, auto-generated if absent
  playlistIds: number[]      // references to library playlist IDs
  createdAt: number          // Date.now() at creation
  lastOpened: number         // Date.now(), updated on each load
}
