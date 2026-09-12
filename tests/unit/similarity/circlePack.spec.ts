import { describe, it, expect } from 'vitest'
import { placeCircles, packCluster } from '@/similarity/circlePack'
import type { ContainmentNode } from '@/similarity/containment'

function node(
  playlistId: number,
  name: string,
  size: number,
  children: ContainmentNode[] = [],
): ContainmentNode {
  return { playlistId, name, size, children, otherContainerCount: 0 }
}

/** True when no two circles overlap, allowing for floating point slop. */
function noOverlaps(circles: { x: number; y: number; r: number }[]): boolean {
  for (let i = 0; i < circles.length; i += 1) {
    for (let j = i + 1; j < circles.length; j += 1) {
      const a = circles[i]!
      const b = circles[j]!
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 1e-6) return false
    }
  }
  return true
}

describe('placeCircles', () => {
  it('puts a single circle at the origin', () => {
    expect(placeCircles([5])).toEqual([{ x: 0, y: 0 }])
  })

  it('seats two circles tangent to each other', () => {
    const centres = placeCircles([3, 2])
    const distance = Math.hypot(centres[1]!.x - centres[0]!.x, centres[1]!.y - centres[0]!.y)
    expect(distance).toBeCloseTo(5, 6)
  })

  it('never overlaps, across a range of sizes', () => {
    const radii = [5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1]
    const centres = placeCircles(radii)
    expect(noOverlaps(centres.map((c, i) => ({ ...c, r: radii[i]! })))).toBe(true)
  })

  it('handles a dozen equal circles, the shape a year of months makes', () => {
    const radii = Array.from({ length: 12 }, () => 1)
    const centres = placeCircles(radii)
    expect(centres).toHaveLength(12)
    expect(noOverlaps(centres.map((c, i) => ({ ...c, r: radii[i]! })))).toBe(true)
  })

  it('respects a requested gap between siblings', () => {
    const centres = placeCircles([2, 2], 0.5)
    const distance = Math.hypot(centres[1]!.x - centres[0]!.x, centres[1]!.y - centres[0]!.y)
    expect(distance).toBeGreaterThanOrEqual(4.5 - 1e-6)
  })

  it('packs toward the origin rather than drifting outward', () => {
    const radii = [3, 1, 1, 1]
    const centres = placeCircles(radii)
    const furthest = Math.max(...centres.map((c, i) => Math.hypot(c.x, c.y) + radii[i]!))
    // A loose bound: anything sane keeps four small circles well inside this.
    expect(furthest).toBeLessThan(12)
  })

  it('is deterministic', () => {
    const radii = [4, 3, 2, 2, 1]
    expect(placeCircles(radii)).toEqual(placeCircles(radii))
  })

  it('returns nothing for no input', () => {
    expect(placeCircles([])).toEqual([])
  })
})

describe('packCluster', () => {
  it('returns nothing for an empty cluster or a zero viewport', () => {
    expect(packCluster([], 400)).toEqual([])
    expect(packCluster([node(1, 'A', 10)], 0)).toEqual([])
  })

  it('centres a lone root in the viewport', () => {
    const [circle] = packCluster([node(1, 'Year', 100)], 400)
    expect(circle!.x).toBeCloseTo(200, 6)
    expect(circle!.y).toBeCloseTo(200, 6)
    expect(circle!.depth).toBe(0)
  })

  it('keeps every circle inside the viewport', () => {
    const circles = packCluster(
      [node(1, 'Year', 100, [node(2, 'Jan', 30), node(3, 'Feb', 30), node(4, 'Mar', 20)])],
      400,
    )
    for (const c of circles) {
      expect(c.x - c.r).toBeGreaterThanOrEqual(-1e-6)
      expect(c.y - c.r).toBeGreaterThanOrEqual(-1e-6)
      expect(c.x + c.r).toBeLessThanOrEqual(400 + 1e-6)
      expect(c.y + c.r).toBeLessThanOrEqual(400 + 1e-6)
    }
  })

  it('emits outermost first, so a painter render nests correctly', () => {
    const circles = packCluster([node(1, 'Year', 100, [node(2, 'Jan', 30)])], 400)
    expect(circles.map((c) => c.depth)).toEqual([0, 1])
  })

  it('draws every child strictly inside its parent', () => {
    const circles = packCluster(
      [node(1, 'Year', 100, [node(2, 'Jan', 40), node(3, 'Feb', 30)])],
      400,
    )
    const parent = circles.find((c) => c.name === 'Year')!
    for (const child of circles.filter((c) => c.depth === 1)) {
      const distance = Math.hypot(child.x - parent.x, child.y - parent.y)
      expect(distance + child.r).toBeLessThanOrEqual(parent.r + 1e-6)
    }
  })

  it('never overlaps siblings', () => {
    const circles = packCluster(
      [
        node(1, 'Year', 392, [
          node(2, 'Jan', 31),
          node(3, 'Feb', 29),
          node(4, 'Mar', 31),
          node(5, 'Apr', 31),
          node(6, 'May', 29),
          node(7, 'Jun', 31),
        ]),
      ],
      400,
    )
    expect(noOverlaps(circles.filter((c) => c.depth === 1))).toBe(true)
  })

  it('nests three levels, which is what makes the map concentric', () => {
    const circles = packCluster(
      [node(1, 'Year', 392, [node(2, 'August', 20, [node(3, 'High_Shit', 3)])])],
      400,
    )
    expect(circles.map((c) => c.depth)).toEqual([0, 1, 2])

    const [year, august, high] = circles
    expect(Math.hypot(august!.x - year!.x, august!.y - year!.y) + august!.r).toBeLessThanOrEqual(
      year!.r + 1e-6,
    )
    expect(
      Math.hypot(high!.x - august!.x, high!.y - august!.y) + high!.r,
    ).toBeLessThanOrEqual(august!.r + 1e-6)
  })

  it('gives a bigger playlist a bigger circle', () => {
    const circles = packCluster([node(1, 'Year', 100, [node(2, 'Big', 50), node(3, 'Small', 5)])], 400)
    const big = circles.find((c) => c.name === 'Big')!
    const small = circles.find((c) => c.name === 'Small')!
    expect(big.r).toBeGreaterThan(small.r)
  })

  it('carries the multi-parent count through to the drawn circle', () => {
    const child: ContainmentNode = {
      playlistId: 2,
      name: 'Shared',
      size: 5,
      children: [],
      otherContainerCount: 2,
    }
    const circles = packCluster([node(1, 'Year', 50, [child])], 400)
    expect(circles.find((c) => c.name === 'Shared')!.otherContainerCount).toBe(2)
  })

  it('places several roots side by side without overlapping', () => {
    const circles = packCluster([node(1, 'A', 50), node(2, 'B', 40), node(3, 'C', 30)], 400)
    expect(circles.filter((c) => c.depth === 0)).toHaveLength(3)
    expect(noOverlaps(circles)).toBe(true)
  })

  it('is deterministic', () => {
    const build = () => [node(1, 'Year', 100, [node(2, 'Jan', 30), node(3, 'Feb', 20)])]
    expect(packCluster(build(), 400)).toEqual(packCluster(build(), 400))
  })
})

describe('packCluster hasChildren', () => {
  it('marks a container and leaves a leaf unmarked', () => {
    const circles = packCluster([node(1, 'Year', 100, [node(2, 'Jan', 30)])], 400)
    expect(circles.find((c) => c.name === 'Year')!.hasChildren).toBe(true)
    expect(circles.find((c) => c.name === 'Jan')!.hasChildren).toBe(false)
  })

  it('marks a mid-chain circle, which is both child and container', () => {
    const circles = packCluster(
      [node(1, 'Year', 100, [node(2, 'August', 20, [node(3, 'High', 3)])])],
      400,
    )
    const august = circles.find((c) => c.name === 'August')!
    expect(august.depth).toBe(1)
    expect(august.hasChildren).toBe(true)
    expect(circles.find((c) => c.name === 'High')!.hasChildren).toBe(false)
  })

  it('marks a childless root unmarked', () => {
    expect(packCluster([node(1, 'Lonely', 10)], 400)[0]!.hasChildren).toBe(false)
  })
})
