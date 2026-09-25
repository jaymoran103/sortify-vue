import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { useFolderStore } from '@/stores/folders'
import type { Playlist } from '@/types/models'

// The folder store reads live playlist names for its snapshot; nothing here needs IndexedDB.
const mockPlaylists = ref<Playlist[]>([])
vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({
    get playlists() {
      return mockPlaylists.value
    },
  }),
}))

const STORAGE_KEY = 'sortify.library.folders.v2'

// jsdom's localStorage is not usable here; stub it, as useSpotifyAuth.spec.ts does.
const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = String(value) },
  removeItem: (key: string) => { delete storage[key] },
  clear: () => { for (const key in storage) delete storage[key] },
  key: (index: number) => Object.keys(storage)[index] ?? null,
  get length() { return Object.keys(storage).length },
} satisfies Storage)

describe('Folder Store', () => {
  beforeEach(() => {
    localStorage.clear()
    mockPlaylists.value = [
      { id: 1, name: 'Alpha', trackIDs: [] },
      { id: 2, name: 'Bravo', trackIDs: [] },
    ]
    setActivePinia(createPinia())
  })

  it('createFolder adds an empty folder under the given parent', () => {
    const store = useFolderStore()
    const parent = store.createFolder('Genres')
    const child = store.createFolder('Electronic', parent)
    expect(store.getFolder(child)).toMatchObject({ name: 'Electronic', parentId: parent, borrowedPlaylistIds: [] })
  })

  it('renameFolder changes the name', () => {
    const store = useFolderStore()
    const id = store.createFolder('Old')
    store.renameFolder(id, 'New')
    expect(store.getFolder(id)?.name).toBe('New')
  })

  it('deleteFolder reparents children and unfiles playlists that lived there', () => {
    const store = useFolderStore()
    const top = store.createFolder('Top')
    const mid = store.createFolder('Mid', top)
    const leaf = store.createFolder('Leaf', mid)
    store.setCanonicalHome(1, mid)

    store.deleteFolder(mid)

    expect(store.getFolder(mid)).toBeUndefined()
    expect(store.getFolder(leaf)?.parentId).toBe(top)
    expect(store.canonicalFolderIds[1]).toBeUndefined()
  })

  it('setCanonicalHome drops a borrow of the playlist in its new home', () => {
    const store = useFolderStore()
    const a = store.createFolder('A')
    store.addBorrow(a, 1)
    store.setCanonicalHome(1, a)
    expect(store.canonicalFolderIds[1]).toBe(a)
    expect(store.getFolder(a)?.borrowedPlaylistIds).toEqual([])
  })

  it('setCanonicalHome with null unfiles the playlist', () => {
    const store = useFolderStore()
    const a = store.createFolder('A')
    store.setCanonicalHome(1, a)
    store.setCanonicalHome(1, null)
    expect(store.canonicalFolderIds[1]).toBeUndefined()
  })

  it('setFolderHomes makes the list exactly the set that lives in the folder', () => {
    const store = useFolderStore()
    const a = store.createFolder('A')
    const b = store.createFolder('B')
    store.setCanonicalHome(1, a)
    store.setCanonicalHome(2, b)

    store.setFolderHomes(a, [2])

    expect(store.canonicalFolderIds[1]).toBeUndefined()
    expect(store.canonicalFolderIds[2]).toBe(a)
  })

  it('setFolderBorrows skips a playlist that lives in the folder', () => {
    const store = useFolderStore()
    const a = store.createFolder('A')
    store.setCanonicalHome(1, a)
    store.setFolderBorrows(a, [1, 2])
    expect(store.getFolder(a)?.borrowedPlaylistIds).toEqual([2])
  })

  it('addBorrow is a no-op for the playlist home and for a repeat', () => {
    const store = useFolderStore()
    const a = store.createFolder('A')
    store.setCanonicalHome(1, a)
    store.addBorrow(a, 1)
    store.addBorrow(a, 2)
    store.addBorrow(a, 2)
    expect(store.getFolder(a)?.borrowedPlaylistIds).toEqual([2])
  })

  it('removeBorrow takes the playlist out of the folder only', () => {
    const store = useFolderStore()
    const a = store.createFolder('A')
    store.addBorrow(a, 2)
    store.removeBorrow(a, 2)
    expect(store.getFolder(a)?.borrowedPlaylistIds).toEqual([])
  })

  it('snapshot carries live playlist names and homes', () => {
    const store = useFolderStore()
    const a = store.createFolder('A')
    store.setCanonicalHome(2, a)
    expect(store.snapshot.playlistNames.get(1)).toBe('Alpha')
    expect(store.snapshot.canonicalFolderIds.get(2)).toBe(a)
  })

  it('persists to localStorage and reloads in a fresh store', async () => {
    const store = useFolderStore()
    const a = store.createFolder('A')
    store.setCanonicalHome(1, a)
    await nextTick()

    setActivePinia(createPinia())
    const reloaded = useFolderStore()
    expect(reloaded.getFolder(a)?.name).toBe('A')
    expect(reloaded.canonicalFolderIds[1]).toBe(a)
  })

  it('starts empty when the stored value is malformed', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    const store = useFolderStore()
    expect(store.folders).toEqual([])
  })
})
