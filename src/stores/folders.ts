import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { usePlaylistStore } from '@/stores/playlists'
import type { Folder } from '@/types/models'
import type { FolderSnapshot } from '@/types/ui'

/**
 * Folder Store: user-defined, nestable groupings of library playlists.
 *
 * PROTOTYPE: state lives in localStorage, not Dexie. Folders reach IndexedDB through a schema
 * bump before any merge to main (PRD D-004); until that schema is settled, keeping them here
 * means a throwaway branch never writes grouping state into a user's real library. Delete the
 * key and the library is exactly as it was.
 *
 * The store holds state and mutations only. Every derived answer (members, overlaps, paths,
 * Unfiled) comes from utils/folderOverlap.ts, fed by `snapshot`.
 */

// v2: proto-library-0901 owns v1, with a different shape.
const STORAGE_KEY = 'sortify.library.folders.v2'

interface PersistedFolders {
  folders: Folder[]
  canonicalFolderIds: Record<number, string>
}

function load(): PersistedFolders {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { folders: [], canonicalFolderIds: {} }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) throw new Error('malformed')
    const { folders, canonicalFolderIds } = parsed as Partial<PersistedFolders>
    return {
      folders: Array.isArray(folders) ? folders : [],
      canonicalFolderIds:
        typeof canonicalFolderIds === 'object' && canonicalFolderIds !== null ? canonicalFolderIds : {},
    }
  } catch {
    // A malformed key is not worth failing the page over. Start clean.
    return { folders: [], canonicalFolderIds: {} }
  }
}

export const useFolderStore = defineStore('folders', () => {
  const playlistStore = usePlaylistStore()
  const initial = load()

  const folders = ref<Folder[]>(initial.folders)
  const canonicalFolderIds = ref<Record<number, string>>(initial.canonicalFolderIds)

  watch(
    [folders, canonicalFolderIds],
    ([f, c]) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders: f, canonicalFolderIds: c }))
      } catch {
        // Quota or private-mode failure: the session still works, it just will not persist.
      }
    },
    { deep: true },
  )

  /** Plain state for the folder rules. Rebuilt when folders, homes or the library change. */
  const snapshot = computed<FolderSnapshot>(() => ({
    folders: folders.value,
    canonicalFolderIds: new Map(
      Object.entries(canonicalFolderIds.value).map(([id, folderId]) => [Number(id), folderId]),
    ),
    playlistNames: new Map(
      (playlistStore.playlists ?? [])
        .filter((p) => p.id !== undefined)
        .map((p) => [p.id!, p.name]),
    ),
  }))

  function getFolder(id: string): Folder | undefined {
    return folders.value.find((f) => f.id === id)
  }

  /** Creates an empty folder under `parentId` (null = top level). Returns its id. */
  function createFolder(name: string, parentId: string | null = null): string {
    const id = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    folders.value = [...folders.value, { id, name, parentId, borrowedPlaylistIds: [] }]
    return id
  }

  function renameFolder(id: string, name: string): void {
    const folder = getFolder(id)
    if (folder) folder.name = name
  }

  /**
   * Removes a folder. Its children move up to its parent rather than being orphaned. Playlists
   * that called it home become unfiled; its borrows simply go with it. Nothing leaves the library.
   */
  function deleteFolder(id: string): void {
    const folder = getFolder(id)
    if (!folder) return
    for (const child of folders.value) {
      if (child.parentId === id) child.parentId = folder.parentId
    }
    folders.value = folders.value.filter((f) => f.id !== id)
    const homes = { ...canonicalFolderIds.value }
    for (const [pid, homeId] of Object.entries(homes)) {
      if (homeId === id) delete homes[Number(pid)]
    }
    canonicalFolderIds.value = homes
  }

  /**
   * Sets a playlist's canonical home, or clears it with null. Also drops any borrow of the
   * playlist in its new home, since a folder never shows the same playlist twice.
   */
  function setCanonicalHome(playlistId: number, folderId: string | null): void {
    const homes = { ...canonicalFolderIds.value }
    if (folderId === null) delete homes[playlistId]
    else homes[playlistId] = folderId
    canonicalFolderIds.value = homes
    if (folderId !== null) removeBorrow(folderId, playlistId)
  }

  /**
   * Makes `playlistIds` exactly the set that calls this folder home. Playlists newly listed move
   * here from wherever they lived; playlists no longer listed become unfiled.
   */
  function setFolderHomes(folderId: string, playlistIds: number[]): void {
    const incoming = new Set(playlistIds)
    const homes = { ...canonicalFolderIds.value }
    for (const [pid, homeId] of Object.entries(homes)) {
      if (homeId === folderId && !incoming.has(Number(pid))) delete homes[Number(pid)]
    }
    for (const pid of incoming) homes[pid] = folderId
    canonicalFolderIds.value = homes
    const folder = getFolder(folderId)
    if (folder) folder.borrowedPlaylistIds = folder.borrowedPlaylistIds.filter((pid) => !incoming.has(pid))
  }

  /** Makes `playlistIds` exactly this folder's borrows. A playlist homed here is skipped. */
  function setFolderBorrows(folderId: string, playlistIds: number[]): void {
    const folder = getFolder(folderId)
    if (!folder) return
    folder.borrowedPlaylistIds = [...new Set(playlistIds)].filter(
      (pid) => canonicalFolderIds.value[pid] !== folderId,
    )
  }

  /** Shows a playlist in a folder other than its home. No-op when the folder is its home. */
  function addBorrow(folderId: string, playlistId: number): void {
    const folder = getFolder(folderId)
    if (!folder || canonicalFolderIds.value[playlistId] === folderId) return
    if (!folder.borrowedPlaylistIds.includes(playlistId)) folder.borrowedPlaylistIds.push(playlistId)
  }

  function removeBorrow(folderId: string, playlistId: number): void {
    const folder = getFolder(folderId)
    if (folder) folder.borrowedPlaylistIds = folder.borrowedPlaylistIds.filter((pid) => pid !== playlistId)
  }

  return {
    folders,
    canonicalFolderIds,
    snapshot,
    getFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    setCanonicalHome,
    setFolderHomes,
    setFolderBorrows,
    addBorrow,
    removeBorrow,
  }
})
