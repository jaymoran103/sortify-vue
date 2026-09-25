import type { Folder } from '@/types/models'
import type { FolderMember, FolderOverlap, FolderSnapshot } from '@/types/ui'
import { formatNameList } from '@/utils/workspaceIssues'

/**
 * Folder rules for the library, over a plain snapshot.
 *
 * Mirrors the contract of workspaceIssues.ts: plain input, plain output, no store and no
 * reactivity, so every rule here is unit-testable without Pinia or fake-indexeddb. The folder
 * store builds the snapshot; views feed it in and render what comes back.
 *
 * The membership model is two-tier. Every playlist has at most one canonical home. A folder
 * may also show playlists whose home is elsewhere, and those are "borrowed". A single home is
 * what keeps this legible: every card can always say where it actually lives.
 */

/**
 * The folder a playlist calls home, or null when it has none.
 *
 * A home id that no longer resolves to a folder counts as none, so a deleted folder cannot
 * strand a playlist outside both its old home and Unfiled.
 */
export function homeOf(snapshot: FolderSnapshot, playlistId: number): Folder | null {
  const homeId = snapshot.canonicalFolderIds.get(playlistId)
  if (!homeId) return null
  return snapshot.folders.find((f) => f.id === homeId) ?? null
}

// Name order within one tier. Ids without a live name were filtered out before this runs.
function byName(snapshot: FolderSnapshot) {
  return (a: number, b: number): number =>
    (snapshot.playlistNames.get(a) ?? '').localeCompare(snapshot.playlistNames.get(b) ?? '')
}

/**
 * Everything shown in one folder: canonical members first, then borrowed, each in name order.
 *
 * Ids that no longer resolve to a live playlist are dropped here rather than pruned from
 * storage, so the rules never depend on observing deletions. A borrow of a playlist whose home
 * is this same folder is ignored, since it would render the card twice.
 */
export function folderMembers(snapshot: FolderSnapshot, folderId: string): FolderMember[] {
  const folder = snapshot.folders.find((f) => f.id === folderId)
  if (!folder) return []

  const live = [...snapshot.playlistNames.keys()]
  const canonical = live
    .filter((id) => homeOf(snapshot, id)?.id === folderId)
    .sort(byName(snapshot))
  const canonicalSet = new Set(canonical)
  const borrowed = [...new Set(folder.borrowedPlaylistIds)]
    .filter((id) => snapshot.playlistNames.has(id) && !canonicalSet.has(id))
    .sort(byName(snapshot))

  const member = (playlistId: number, isBorrowed: boolean): FolderMember => {
    const home = homeOf(snapshot, playlistId)
    return {
      playlistId,
      borrowed: isBorrowed,
      canonicalFolderId: home?.id ?? null,
      canonicalFolderName: home?.name ?? null,
    }
  }

  return [...canonical.map((id) => member(id, false)), ...borrowed.map((id) => member(id, true))]
}

/**
 * Direct children of a folder, in declaration order. Pass null for the top level.
 *
 * A folder whose parent no longer resolves is treated as top level, so deleting a parent by
 * hand in storage never hides its children.
 */
export function childFolders(snapshot: FolderSnapshot, parentId: string | null): Folder[] {
  const ids = new Set(snapshot.folders.map((f) => f.id))
  return snapshot.folders.filter((f) => {
    const parent = f.parentId !== null && ids.has(f.parentId) ? f.parentId : null
    return parent === parentId
  })
}

/**
 * Root-to-folder chain for the breadcrumb, ending at the folder itself.
 *
 * Empty if the id does not resolve. The walk is capped at the folder count because storage is
 * hand-editable and a parentId cycle would otherwise loop forever.
 */
export function folderPath(snapshot: FolderSnapshot, folderId: string): Folder[] {
  const byId = new Map(snapshot.folders.map((f) => [f.id, f]))
  const path: Folder[] = []
  let current = byId.get(folderId)
  while (current && path.length < snapshot.folders.length) {
    if (path.includes(current)) break
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

/** Live playlists with no canonical home, in name order. These make up the Unfiled row. */
export function unfiledPlaylistIds(snapshot: FolderSnapshot): number[] {
  return [...snapshot.playlistNames.keys()]
    .filter((id) => homeOf(snapshot, id) === null)
    .sort(byName(snapshot))
}

/**
 * One entry per folder displaying at least one borrowed member. Never throws.
 *
 * The message names the homes the borrowed members live in, capped at three names by
 * formatNameList, which is what a row header has room for.
 */
export function collectFolderOverlaps(snapshot: FolderSnapshot): FolderOverlap[] {
  const overlaps: FolderOverlap[] = []

  for (const folder of snapshot.folders) {
    const members = folderMembers(snapshot, folder.id)
    const borrowed = members.filter((m) => m.borrowed)
    if (borrowed.length === 0) continue

    const homes = [...new Set(borrowed.map((m) => m.canonicalFolderName ?? 'Unfiled'))]
    overlaps.push({
      code: 'borrowed-members',
      folderId: folder.id,
      canonicalCount: members.length - borrowed.length,
      borrowedCount: borrowed.length,
      message: `${borrowed.length} of ${members.length} here live in ${formatNameList(homes)}.`,
      ids: borrowed.map((m) => String(m.playlistId)),
    })
  }

  return overlaps
}
