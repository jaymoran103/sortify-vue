import { describe, it, expect } from 'vitest'
import { buildIndex } from '@/similarity/invertedIndex'
import { findContainmentPairs, buildContainmentClusters } from '@/similarity/containment'
import type { IndexInput } from '@/similarity/types'

function index(playlists: IndexInput[]) {
  return buildIndex(playlists)
}

describe('findContainmentPairs', () => {
  it('finds a playlist wholly inside a larger one', () => {
    const pairs = findContainmentPairs(
      index([
        { id: 1, name: 'Year', trackIDs: ['a', 'b', 'c'] },
        { id: 2, name: 'Month', trackIDs: ['a', 'b'] },
      ]),
    )
    expect(pairs).toEqual([{ innerId: 2, outerId: 1 }])
  })

  it('ignores a playlist that only partly overlaps', () => {
    const pairs = findContainmentPairs(
      index([
        { id: 1, name: 'Year', trackIDs: ['a', 'b'] },
        { id: 2, name: 'Other', trackIDs: ['b', 'z'] },
      ]),
    )
    expect(pairs).toEqual([])
  })

  it('excludes identical playlists, which are mutual rather than nested', () => {
    const pairs = findContainmentPairs(
      index([
        { id: 1, name: 'Original', trackIDs: ['a', 'b'] },
        { id: 2, name: 'Copy', trackIDs: ['a', 'b'] },
      ]),
    )
    expect(pairs).toEqual([])
  })

  it('reports every container when a playlist sits inside several', () => {
    const pairs = findContainmentPairs(
      index([
        { id: 1, name: 'Big', trackIDs: ['a', 'b', 'c'] },
        { id: 2, name: 'Medium', trackIDs: ['a', 'b'] },
        { id: 3, name: 'Small', trackIDs: ['a'] },
      ]),
    )
    expect(pairs).toContainEqual({ innerId: 3, outerId: 1 })
    expect(pairs).toContainEqual({ innerId: 3, outerId: 2 })
    expect(pairs).toContainEqual({ innerId: 2, outerId: 1 })
  })

  it('ignores empty playlists', () => {
    const pairs = findContainmentPairs(
      index([
        { id: 1, name: 'Full', trackIDs: ['a'] },
        { id: 2, name: 'Empty', trackIDs: [] },
      ]),
    )
    expect(pairs).toEqual([])
  })

  it('treats duplicate entries as one track, matching the rest of the module', () => {
    const pairs = findContainmentPairs(
      index([
        { id: 1, name: 'Year', trackIDs: ['a', 'b'] },
        { id: 2, name: 'Dupey', trackIDs: ['a', 'a'] },
      ]),
    )
    expect(pairs).toEqual([{ innerId: 2, outerId: 1 }])
  })
})

describe('buildContainmentClusters', () => {
  it('returns nothing when no playlist contains another', () => {
    expect(
      buildContainmentClusters(
        index([
          { id: 1, name: 'A', trackIDs: ['a'] },
          { id: 2, name: 'B', trackIDs: ['b'] },
        ]),
      ),
    ).toEqual([])
  })

  it('nests a child under its container', () => {
    const [cluster] = buildContainmentClusters(
      index([
        { id: 1, name: 'Year', trackIDs: ['a', 'b', 'c'] },
        { id: 2, name: 'Month', trackIDs: ['a'] },
      ]),
    )
    expect(cluster!.roots).toHaveLength(1)
    expect(cluster!.roots[0]!.name).toBe('Year')
    expect(cluster!.roots[0]!.children.map((c) => c.name)).toEqual(['Month'])
  })

  it('builds a three-level chain, which is what makes the map concentric', () => {
    const [cluster] = buildContainmentClusters(
      index([
        { id: 1, name: 'Year', trackIDs: ['a', 'b', 'c', 'd'] },
        { id: 2, name: 'Month', trackIDs: ['a', 'b'] },
        { id: 3, name: 'Day', trackIDs: ['a'] },
      ]),
    )
    expect(cluster!.depth).toBe(3)
    const year = cluster!.roots[0]!
    expect(year.name).toBe('Year')
    expect(year.children[0]!.name).toBe('Month')
    expect(year.children[0]!.children[0]!.name).toBe('Day')
  })

  it('draws a multi-parent child under its smallest container only', () => {
    const [cluster] = buildContainmentClusters(
      index([
        { id: 1, name: 'Big', trackIDs: ['a', 'b', 'c', 'd'] },
        { id: 2, name: 'Medium', trackIDs: ['a', 'b'] },
        { id: 3, name: 'Small', trackIDs: ['a'] },
      ]),
    )
    const big = cluster!.roots[0]!
    const medium = big.children.find((c) => c.name === 'Medium')!
    expect(medium.children.map((c) => c.name)).toEqual(['Small'])
    expect(big.children.map((c) => c.name)).toEqual(['Medium'])
  })

  it('records how many containers a child was not drawn under', () => {
    const [cluster] = buildContainmentClusters(
      index([
        { id: 1, name: 'Big', trackIDs: ['a', 'b', 'c', 'd'] },
        { id: 2, name: 'Medium', trackIDs: ['a', 'b'] },
        { id: 3, name: 'Small', trackIDs: ['a'] },
      ]),
    )
    const small = cluster!.roots[0]!.children[0]!.children[0]!
    expect(small.name).toBe('Small')
    expect(small.otherContainerCount).toBe(1)
    expect(cluster!.multiParentCount).toBe(1)
  })

  it('orders children largest first, so packing places the dominant one first', () => {
    const [cluster] = buildContainmentClusters(
      index([
        { id: 1, name: 'Year', trackIDs: ['a', 'b', 'c', 'd', 'e'] },
        { id: 2, name: 'Small', trackIDs: ['a'] },
        { id: 3, name: 'Large', trackIDs: ['a', 'b', 'c'] },
      ]),
    )
    // Small is inside Large, which is inside Year.
    expect(cluster!.roots[0]!.children.map((c) => c.name)).toEqual(['Large'])
    expect(cluster!.roots[0]!.children[0]!.children.map((c) => c.name)).toEqual(['Small'])
  })

  it('separates unrelated groups into different clusters', () => {
    const clusters = buildContainmentClusters(
      index([
        { id: 1, name: 'YearA', trackIDs: ['a', 'b'] },
        { id: 2, name: 'MonthA', trackIDs: ['a'] },
        { id: 3, name: 'YearB', trackIDs: ['x', 'y'] },
        { id: 4, name: 'MonthB', trackIDs: ['x'] },
      ]),
    )
    expect(clusters).toHaveLength(2)
  })

  it('reports coverage of the roots by their direct children', () => {
    const [cluster] = buildContainmentClusters(
      index([
        { id: 1, name: 'Year', trackIDs: ['a', 'b', 'c', 'd'] },
        { id: 2, name: 'Jan', trackIDs: ['a', 'b'] },
        { id: 3, name: 'Feb', trackIDs: ['c'] },
      ]),
    )
    expect(cluster!.totalTracks).toBe(4)
    expect(cluster!.coveredTracks).toBe(3)
  })

  it('counts every playlist in the cluster', () => {
    const [cluster] = buildContainmentClusters(
      index([
        { id: 1, name: 'Year', trackIDs: ['a', 'b', 'c'] },
        { id: 2, name: 'Jan', trackIDs: ['a'] },
        { id: 3, name: 'Feb', trackIDs: ['b'] },
      ]),
    )
    expect(cluster!.playlistCount).toBe(3)
  })

  it('ranks a deep clean cluster ahead of a shallow tangled one', () => {
    const clusters = buildContainmentClusters(
      index([
        // Shallow but large: one container, three children.
        { id: 1, name: 'Flat', trackIDs: ['p', 'q', 'r', 's'] },
        { id: 2, name: 'F1', trackIDs: ['p'] },
        { id: 3, name: 'F2', trackIDs: ['q'] },
        { id: 4, name: 'F3', trackIDs: ['r'] },
        // Deep: a genuine three-level chain.
        { id: 5, name: 'Deep', trackIDs: ['x', 'y', 'z'] },
        { id: 6, name: 'Mid', trackIDs: ['x', 'y'] },
        { id: 7, name: 'Tip', trackIDs: ['x'] },
      ]),
    )
    expect(clusters[0]!.roots[0]!.name).toBe('Deep')
    expect(clusters[0]!.depth).toBe(3)
  })
})
