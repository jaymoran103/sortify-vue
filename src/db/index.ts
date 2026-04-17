import Dexie, { type Table } from 'dexie'
import { ref } from 'vue'
import type { Track, Playlist, WorkspaceSession } from '@/types/models'

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
 * workspaceSessions:
 * - Represents user sessions that can contain multiple playlists. This allows users to save and load sets of playlists for different projects or moods.
 * - Primary key: id (number, auto-incrementing)
 * - Indexed fields: 'lastOpened'.
 * 
 * An instance of SortifyDB is created and exported as 'db' for use throughout the application.
 * 
 */

/** Reactive flag set when this connection's upgrade is blocked by an older open connection. */
export const dbBlockedFlag = ref(false)

export class SortifyDB extends Dexie {
  tracks!: Table<Track, string>
  playlists!: Table<Playlist, number>
  workspaceSessions!: Table<WorkspaceSession, number>


  // NOTE: Bump this number for every schema change, even non-breaking ones, to trigger the versionchange flow in older tabs. 
  // New versions should always be strictly greater than any previously deployed version, ensuring safe writes.
  public static readonly CURRENT_VERSION = 5

  constructor() {
    super('SortifyDB')

    this.version(SortifyDB.CURRENT_VERSION).stores({
      tracks: 'trackID, source',
      playlists: '++id, name',
      workspaceSessions: '++id, lastOpened',
    })

    // Close this connection immediately when another tab requests a newer version.
    // Without this, open tabs permanently block upgrades in newer deployments.
    this.on('versionchange', () => {
      this.close()
    })

    // Set the blocked flag when our own upgrade attempt is blocked by an older connection.
    this.on('blocked', () => {
      dbBlockedFlag.value = true
    })
  }
}

export const db = new SortifyDB()
