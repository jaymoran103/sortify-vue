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
  id?: number
  name: string
  trackIDs: string[]
  playlistURI?: string
  timeAdded?: number
  lastModified?: number
}
