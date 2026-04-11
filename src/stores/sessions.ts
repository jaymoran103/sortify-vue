import { defineStore } from 'pinia'
import { db } from '@/db'
import { useLiveQuery } from '@/composables/useLiveQuery'
import type { WorkspaceSession } from '@/types/models'

export const useSessionStore = defineStore('sessions', () => {
  // Reactive list of all sessions, ordered by most recently opened
  const sessions = useLiveQuery(
    () => db.workspaceSessions.orderBy('lastOpened').reverse().toArray(),
    [],
  )

  // Creates a new session with the given playlist IDs and optional name, returning the new session's ID
  async function createSession(playlistIds: number[], name?: string): Promise<number> {
    const now = Date.now()
    const id = await db.workspaceSessions.add({
      playlistIds,
      name: name ?? `Session ${new Date(now).toLocaleDateString()}`,
      createdAt: now,
      lastOpened: now,
    })
    return id as number
  }

  // Retrieves a session by ID, or undefined if not found
  async function getSession(id: number): Promise<WorkspaceSession | undefined> {
    return db.workspaceSessions.get(id)
  }

  // Updates the lastOpened timestamp of a session to the current time
  async function touchSession(id: number): Promise<void> {
    await db.workspaceSessions.update(id, { lastOpened: Date.now() })
  }

  // Updates a session with the given changes (e.g. renaming, changing playlists)
  async function updateSession(id: number, changes: Partial<WorkspaceSession>): Promise<void> {
    await db.workspaceSessions.update(id, changes)
  }

  // Deletes a session by ID
  async function deleteSession(id: number): Promise<void> {
    await db.workspaceSessions.delete(id)
  }

  return { sessions, createSession, getSession, touchSession, updateSession, deleteSession }
})
