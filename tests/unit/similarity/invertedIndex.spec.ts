import { describe, it, expect } from 'vitest'
import { buildIndex } from '@/similarity/invertedIndex'
import type { IndexInput } from '@/similarity/types'

const PLAYLISTS: IndexInput[] = [
  { id: 1, name: 'Blues Rock', trackIDs: ['a', 'b', 'c'] },
  { id: 2, name: 'Classic Blues', trackIDs: ['b', 'c', 'd'] },
  { id: 3, name: 'Dupes', trackIDs: ['a', 'a', 'e'] },
]

describe('buildIndex', () => {
  it('maps every track to the playlists containing it', () => {
    const index = buildIndex(PLAYLISTS)
    expect(index.trackToPlaylists.get('a')).toEqual([1, 3])
    expect(index.trackToPlaylists.get('b')).toEqual([1, 2])
    expect(index.trackToPlaylists.get('e')).toEqual([3])
  })

  it('stores unique track sets per playlist', () => {
    const index = buildIndex(PLAYLISTS)
    expect(index.playlistSets.get(1)).toEqual(new Set(['a', 'b', 'c']))
    expect(index.playlistSets.get(3)).toEqual(new Set(['a', 'e']))
  })

  it('records unique size and raw size separately when a playlist has duplicates', () => {
    const index = buildIndex(PLAYLISTS)
    expect(index.playlistSizes.get(3)).toBe(2)
    expect(index.rawSizes.get(3)).toBe(3)
  })

  it('records matching unique and raw sizes when a playlist has no duplicates', () => {
    const index = buildIndex(PLAYLISTS)
    expect(index.playlistSizes.get(1)).toBe(3)
    expect(index.rawSizes.get(1)).toBe(3)
  })

  it('carries playlist names for row labelling', () => {
    const index = buildIndex(PLAYLISTS)
    expect(index.playlistNames.get(2)).toBe('Classic Blues')
  })

  it('returns empty maps for an empty library', () => {
    const index = buildIndex([])
    expect(index.trackToPlaylists.size).toBe(0)
    expect(index.playlistSets.size).toBe(0)
  })
})
