import Dexie, { type Table } from 'dexie'
import type { Track, Playlist } from '@/types/models'

/**
 * SortifyDB is a Dexie database that manages two tables: 'tracks' and 'playlists'.
 * 
 * tracks:
 * - Represents individual songs. track variants or duplicates with different identifiers will be stored as separate entries and associated via the similarity module later on.
 * - Primary key: trackID (string)
 * - Indexed fields: source
 * 
 * playlists:
 * - Represents collections of tracks, referenced via their trackIDs. Duplicate tracks within a playlist (with or without matching IDs) are not managed or reduced
 * - Primary key: id (number, auto-incrementing)
 * - Indexed fields: 'name'.
 * 
 * 
 * An instance of SortifyDB is created and exported as 'db' for use throughout the application.
 */
export class SortifyDB extends Dexie {
  tracks!: Table<Track, string>
  playlists!: Table<Playlist, number>

  constructor() {
    super('SortifyDB')
    this.version(1).stores({
      tracks: 'trackID, source',
      playlists: '++id, name',
    })
  }
}

export const db = new SortifyDB()
