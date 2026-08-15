import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEquivalenceStore } from '@/stores/equivalence'
import { db } from '@/db'

/**
 * Equivalence Store Tests
 * Follows the existing store-test pattern: clear the table after each test rather than deleting
 * the database, which would close the singleton and break later suites.
 */
describe('Equivalence Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await db.equivalenceGroups.clear()
  })

  async function seed(): Promise<number> {
    return db.equivalenceGroups.add({
      trackIds: ['a', 'b'],
      status: 'unconfirmed',
      matchTier: 'high',
      detectedAt: 1,
    }) as Promise<number>
  }

  it('saves detected groups as unconfirmed', async () => {
    const store = useEquivalenceStore()
    await store.saveDetected([{ trackIds: ['a', 'b'], matchTier: 'high' }])
    const stored = await db.equivalenceGroups.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.status).toBe('unconfirmed')
    expect(stored[0]!.detectedAt).toBeGreaterThan(0)
  })

  it('writes many detected groups in one transaction', async () => {
    const store = useEquivalenceStore()
    await store.saveDetected([
      { trackIds: ['a', 'b'], matchTier: 'high' },
      { trackIds: ['c', 'd'], matchTier: 'low' },
    ])
    expect(await db.equivalenceGroups.count()).toBe(2)
  })

  it('does nothing when there is nothing to save', async () => {
    const store = useEquivalenceStore()
    await store.saveDetected([])
    expect(await db.equivalenceGroups.count()).toBe(0)
  })

  it('confirms a group and records when it was reviewed', async () => {
    const store = useEquivalenceStore()
    const id = await seed()
    await store.confirm(id)
    const stored = await db.equivalenceGroups.get(id)
    expect(stored?.status).toBe('confirmed')
    expect(stored?.reviewedAt).toBeGreaterThan(0)
  })

  it('confirms with a preferred variant in one call', async () => {
    const store = useEquivalenceStore()
    const id = await seed()
    await store.confirm(id, 'b')
    expect((await db.equivalenceGroups.get(id))?.preferredTrackId).toBe('b')
  })

  it('rejects a group', async () => {
    const store = useEquivalenceStore()
    const id = await seed()
    await store.reject(id)
    expect((await db.equivalenceGroups.get(id))?.status).toBe('rejected')
  })

  it('sets a preferred variant without changing review status', async () => {
    const store = useEquivalenceStore()
    const id = await seed()
    await store.setPreferred(id, 'b')
    const stored = await db.equivalenceGroups.get(id)
    expect(stored?.preferredTrackId).toBe('b')
    expect(stored?.status).toBe('unconfirmed')
  })

  it('resets a group back to unconfirmed', async () => {
    const store = useEquivalenceStore()
    const id = await seed()
    await store.confirm(id)
    await store.resetGroup(id)
    expect((await db.equivalenceGroups.get(id))?.status).toBe('unconfirmed')
  })

  it('confirms many groups at once', async () => {
    const store = useEquivalenceStore()
    const first = await seed()
    const second = (await db.equivalenceGroups.add({
      trackIds: ['c', 'd'],
      status: 'unconfirmed',
      matchTier: 'low',
      detectedAt: 1,
    })) as number
    await store.confirmAll([first, second])
    const stored = await db.equivalenceGroups.toArray()
    expect(stored.every((g) => g.status === 'confirmed')).toBe(true)
  })

  it('maps every track in a confirmed group to the preferred variant', async () => {
    const store = useEquivalenceStore()
    const id = await seed()
    await store.confirm(id, 'b')
    await db.equivalenceGroups.toArray()
    // Read through the store's own reactive state rather than the table.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(store.canonicalMap.get('a')).toBe('b')
    expect(store.canonicalMap.get('b')).toBe('b')
  })

  it('leaves unconfirmed groups out of the canonical map', async () => {
    const store = useEquivalenceStore()
    await seed()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(store.canonicalMap.size).toBe(0)
  })

  it('falls back to the first track when no preferred variant is set', async () => {
    const store = useEquivalenceStore()
    const id = await seed()
    await store.confirm(id)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(store.canonicalMap.get('b')).toBe('a')
  })

  it('reports known groups so a rescan can skip decided tracks', async () => {
    const store = useEquivalenceStore()
    const id = await seed()
    await store.reject(id)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(store.knownGroups).toEqual([{ trackIds: ['a', 'b'], status: 'rejected' }])
  })

  it('counts unconfirmed groups for the rail', async () => {
    const store = useEquivalenceStore()
    await seed()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(store.unconfirmedCount).toBe(1)
  })

  it('finds the group containing a track', async () => {
    const store = useEquivalenceStore()
    await seed()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(store.groupForTrack('b')?.trackIds).toEqual(['a', 'b'])
    expect(store.groupForTrack('zzz')).toBeUndefined()
  })

  it('clears every group', async () => {
    const store = useEquivalenceStore()
    await seed()
    await store.clearAll()
    expect(await db.equivalenceGroups.count()).toBe(0)
  })
})
