import { describe, it, expect } from 'vitest'
import {
  childFolders,
  collectFolderOverlaps,
  folderMembers,
  folderPath,
  homeOf,
  unfiledPlaylistIds,
} from '@/utils/folderOverlap'
import type { Folder } from '@/types/models'
import type { FolderSnapshot } from '@/types/ui'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFolder(id: string, parentId: string | null = null, borrowedPlaylistIds: number[] = []): Folder {
  return { id, name: id.toUpperCase(), parentId, borrowedPlaylistIds }
}

function makeSnapshot(
  folders: Folder[],
  homes: Record<number, string> = {},
  names: Record<number, string> = { 1: 'Alpha', 2: 'Bravo', 3: 'Charlie', 4: 'Delta' },
): FolderSnapshot {
  return {
    folders,
    canonicalFolderIds: new Map(Object.entries(homes).map(([id, f]) => [Number(id), f])),
    playlistNames: new Map(Object.entries(names).map(([id, n]) => [Number(id), n])),
  }
}

// ─── homeOf ──────────────────────────────────────────────────────────────────

describe('homeOf', () => {
  it('returns the folder a playlist calls home', () => {
    const snap = makeSnapshot([makeFolder('a')], { 1: 'a' })
    expect(homeOf(snap, 1)?.id).toBe('a')
  })

  it('returns null when the home id no longer resolves to a folder', () => {
    const snap = makeSnapshot([], { 1: 'gone' })
    expect(homeOf(snap, 1)).toBeNull()
  })
})

// ─── folderMembers ───────────────────────────────────────────────────────────

describe('folderMembers', () => {
  it('lists canonical members before borrowed ones, each in name order', () => {
    const snap = makeSnapshot(
      [makeFolder('a', null, [4, 1]), makeFolder('b')],
      { 3: 'a', 2: 'a', 1: 'b' },
    )
    const members = folderMembers(snap, 'a')
    expect(members.map((m) => [m.playlistId, m.borrowed])).toEqual([
      [2, false],
      [3, false],
      [1, true],
      [4, true],
    ])
  })

  it('names the canonical home of a borrowed member', () => {
    const snap = makeSnapshot([makeFolder('a', null, [1]), makeFolder('b')], { 1: 'b' })
    const [member] = folderMembers(snap, 'a')
    expect(member).toMatchObject({ borrowed: true, canonicalFolderId: 'b', canonicalFolderName: 'B' })
  })

  it('reports no home for a borrowed member that is otherwise unfiled', () => {
    const snap = makeSnapshot([makeFolder('a', null, [1])])
    expect(folderMembers(snap, 'a')[0]).toMatchObject({ borrowed: true, canonicalFolderId: null })
  })

  it('drops ids that no longer resolve to a live playlist', () => {
    const snap = makeSnapshot([makeFolder('a', null, [99])], { 98: 'a' })
    expect(folderMembers(snap, 'a')).toEqual([])
  })

  it('ignores a borrow of a playlist whose home is the same folder', () => {
    const snap = makeSnapshot([makeFolder('a', null, [1])], { 1: 'a' })
    const members = folderMembers(snap, 'a')
    expect(members).toHaveLength(1)
    expect(members[0]?.borrowed).toBe(false)
  })

  it('returns an empty array for an unknown folder', () => {
    expect(folderMembers(makeSnapshot([]), 'nope')).toEqual([])
  })
})

// ─── childFolders ────────────────────────────────────────────────────────────

describe('childFolders', () => {
  it('returns top-level folders in declaration order for null', () => {
    const snap = makeSnapshot([makeFolder('b'), makeFolder('c', 'b'), makeFolder('a')])
    expect(childFolders(snap, null).map((f) => f.id)).toEqual(['b', 'a'])
  })

  it('returns the direct children of a folder only', () => {
    const snap = makeSnapshot([makeFolder('a'), makeFolder('b', 'a'), makeFolder('c', 'b')])
    expect(childFolders(snap, 'a').map((f) => f.id)).toEqual(['b'])
  })

  it('treats a folder whose parent is missing as top level', () => {
    const snap = makeSnapshot([makeFolder('orphan', 'gone')])
    expect(childFolders(snap, null).map((f) => f.id)).toEqual(['orphan'])
  })
})

// ─── folderPath ──────────────────────────────────────────────────────────────

describe('folderPath', () => {
  it('walks root to folder at depth 3', () => {
    const snap = makeSnapshot([makeFolder('a'), makeFolder('b', 'a'), makeFolder('c', 'b')])
    expect(folderPath(snap, 'c').map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })

  it('terminates on a parentId cycle', () => {
    const snap = makeSnapshot([makeFolder('a', 'b'), makeFolder('b', 'a')])
    const path = folderPath(snap, 'a')
    expect(path.length).toBeLessThanOrEqual(2)
    expect(path[path.length - 1]?.id).toBe('a')
  })

  it('returns an empty array when the id does not resolve', () => {
    expect(folderPath(makeSnapshot([makeFolder('a')]), 'nope')).toEqual([])
  })
})

// ─── unfiledPlaylistIds ──────────────────────────────────────────────────────

describe('unfiledPlaylistIds', () => {
  it('returns live playlists with no home, in name order', () => {
    const snap = makeSnapshot([makeFolder('a')], { 2: 'a' })
    expect(unfiledPlaylistIds(snap)).toEqual([1, 3, 4])
  })

  it('counts a playlist whose home was deleted as unfiled', () => {
    const snap = makeSnapshot([], { 1: 'gone' }, { 1: 'Alpha' })
    expect(unfiledPlaylistIds(snap)).toEqual([1])
  })
})

// ─── collectFolderOverlaps ───────────────────────────────────────────────────

describe('collectFolderOverlaps', () => {
  it('returns an empty array when nothing is borrowed', () => {
    const snap = makeSnapshot([makeFolder('a'), makeFolder('b')], { 1: 'a', 2: 'b' })
    expect(collectFolderOverlaps(snap)).toEqual([])
  })

  it('reports canonical and borrowed counts for a folder that borrows', () => {
    const snap = makeSnapshot([makeFolder('a', null, [2]), makeFolder('b')], { 1: 'a', 2: 'b' })
    const [overlap] = collectFolderOverlaps(snap)
    expect(overlap).toMatchObject({
      code: 'borrowed-members',
      folderId: 'a',
      canonicalCount: 1,
      borrowedCount: 1,
      ids: ['2'],
    })
  })

  it('names the homes the borrowed members live in', () => {
    const snap = makeSnapshot(
      [makeFolder('a', null, [2, 3]), makeFolder('b')],
      { 1: 'a', 2: 'b' },
    )
    expect(collectFolderOverlaps(snap)[0]?.message).toBe('2 of 3 here live in "B" and "Unfiled".')
  })
})
