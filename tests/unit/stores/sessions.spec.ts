import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/sessions'
import { db } from '@/db'

describe('Session Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await db.workspaceSessions.clear()
  })

  it('createSession returns a numeric ID', async () => {
    const store = useSessionStore()
    const id = await store.createSession([1, 2, 3])
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('createSession stores the session in the DB', async () => {
    const store = useSessionStore()
    const id = await store.createSession([1, 2])
    const retrieved = await store.getSession(id)
    expect(retrieved).toBeDefined()
    expect(retrieved?.playlistIds).toEqual([1, 2])
  })

  it('createSession uses provided name', async () => {
    const store = useSessionStore()
    const id = await store.createSession([1], 'My Session')
    const retrieved = await store.getSession(id)
    expect(retrieved?.name).toBe('My Session')
  })

  it('createSession generates a name when none provided', async () => {
    const store = useSessionStore()
    const id = await store.createSession([1])
    const retrieved = await store.getSession(id)
    expect(retrieved?.name).toBeTruthy()
    expect(typeof retrieved?.name).toBe('string')
  })

  it('getSession returns session by ID', async () => {
    const store = useSessionStore()
    const id = await store.createSession([5, 6])
    const session = await store.getSession(id)
    expect(session?.id).toBe(id)
    expect(session?.playlistIds).toEqual([5, 6])
  })

  it('getSession returns undefined for nonexistent ID', async () => {
    const store = useSessionStore()
    const session = await store.getSession(99999)
    expect(session).toBeUndefined()
  })

  it('touchSession updates lastOpened timestamp', async () => {
    const store = useSessionStore()
    const before = Date.now()
    const id = await store.createSession([1])
    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 5))
    await store.touchSession(id)
    const session = await store.getSession(id)
    expect(session?.lastOpened).toBeGreaterThan(before)
  })

  it('updateSession applies partial changes', async () => {
    const store = useSessionStore()
    const id = await store.createSession([1, 2], 'Old Name')
    await store.updateSession(id, { name: 'New Name' })
    const session = await store.getSession(id)
    expect(session?.name).toBe('New Name')
    expect(session?.playlistIds).toEqual([1, 2])
  })

  it('deleteSession removes session from DB', async () => {
    const store = useSessionStore()
    const id = await store.createSession([1])
    await store.deleteSession(id)
    const session = await store.getSession(id)
    expect(session).toBeUndefined()
  })

  it('sessions reactive list updates when sessions are added', async () => {
    const store = useSessionStore()
    // Wait for initial liveQuery emission
    await new Promise((r) => setTimeout(r, 20))
    const before = (store.sessions ?? []).length
    await store.createSession([1])
    // Wait for liveQuery to emit the update
    await new Promise((r) => setTimeout(r, 20))
    const after = (store.sessions ?? []).length
    expect(after).toBe(before + 1)
  })

  it('sessions reactive list updates when sessions are deleted', async () => {
    const store = useSessionStore()
    const id = await store.createSession([1])
    await new Promise((r) => setTimeout(r, 20))
    const before = (store.sessions ?? []).length
    await store.deleteSession(id)
    await new Promise((r) => setTimeout(r, 20))
    const after = (store.sessions ?? []).length
    expect(after).toBe(before - 1)
  })
})
