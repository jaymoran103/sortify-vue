import type { ContainmentNode } from './containment'

/**
 * Circle packing for the containment map.
 *
 * Full containment means a Venn diagram degenerates into nested circles: there are no partial
 * overlap crescents to draw, because an inner playlist's tracks are entirely inside the outer's.
 * That makes concentric circles the honest primitive, and the layout a packing problem rather
 * than a set-geometry one.
 *
 * Pure and deterministic, so the whole thing unit-tests without a DOM.
 */

/** One circle to draw. Emitted outermost first, so a painter's-algorithm render nests correctly. */
export interface PackedCircle {
  playlistId: number
  name: string
  size: number
  otherContainerCount: number
  x: number
  y: number
  r: number
  /** 0 for a cluster root, 1 for its children, and so on. Drives styling, not geometry. */
  depth: number
  /**
   * Whether anything is nested inside. A container's interior belongs to its children, so its
   * label goes on the rim; a leaf can use its middle.
   */
  hasChildren: boolean
}

/** Fraction of a parent's radius its children may occupy, leaving a visible ring for the label. */
const CHILD_AREA = 0.86

/** Gap between siblings, as a fraction of the parent radius. Keeps edges from visually merging. */
const SIBLING_GAP = 0.015

/** Candidate angles tried when seating a circle against an already-placed one. */
const ANGLE_STEPS = 60

interface Placed {
  x: number
  y: number
  r: number
}

/**
 * Greedily seats circles of the given radii so none overlap, packed toward the origin.
 *
 * Input: radii, largest first.
 * Output: a centre for each, in the same order, in the same units as the radii.
 * Side effects: none.
 *
 * Each circle after the first is tried tangent to every circle already placed, at a fixed ring of
 * angles, and takes the free position nearest the origin. That is not an optimal packing, but it
 * is deterministic, has no dependencies, and looks right for the handful of siblings a real
 * containment cluster produces.
 */
export function placeCircles(radii: number[], gap = 0): { x: number; y: number }[] {
  const placed: Placed[] = []

  for (const r of radii) {
    if (placed.length === 0) {
      placed.push({ x: 0, y: 0, r })
      continue
    }

    let best: { x: number; y: number } | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (const anchor of placed) {
      const ringRadius = anchor.r + r + gap
      for (let step = 0; step < ANGLE_STEPS; step += 1) {
        const angle = (step / ANGLE_STEPS) * Math.PI * 2
        const x = anchor.x + Math.cos(angle) * ringRadius
        const y = anchor.y + Math.sin(angle) * ringRadius

        let collides = false
        for (const other of placed) {
          const dx = x - other.x
          const dy = y - other.y
          // A hair of tolerance, so a circle seated exactly tangent is not rejected by rounding.
          if (Math.hypot(dx, dy) < other.r + r + gap - 1e-9) {
            collides = true
            break
          }
        }
        if (collides) continue

        const distance = Math.hypot(x, y)
        if (distance < bestDistance) {
          bestDistance = distance
          best = { x, y }
        }
      }
    }

    // Every angle against every anchor was blocked: fall back to a spot clear of everything.
    if (!best) {
      const reach = placed.reduce((max, p) => Math.max(max, Math.hypot(p.x, p.y) + p.r), 0)
      best = { x: reach + r + gap, y: 0 }
    }

    placed.push({ x: best.x, y: best.y, r })
  }

  return placed.map(({ x, y }) => ({ x, y }))
}

/** Smallest radius centred on the origin that encloses every placed circle. */
function boundingRadius(centres: { x: number; y: number }[], radii: number[]): number {
  let max = 0
  for (let i = 0; i < centres.length; i += 1) {
    max = Math.max(max, Math.hypot(centres[i]!.x, centres[i]!.y) + radii[i]!)
  }
  return max
}

/**
 * Lays a node's children out inside it, recursing into their own children.
 *
 * Radii start proportional to the square root of track count, so area tracks size, then the whole
 * arrangement is scaled to fit the parent. The scale step means drawn area understates a child's
 * true share whenever siblings are dense — circles cannot tile a circle — so the view states
 * coverage numerically rather than asking the reader to judge it by eye.
 */
function layoutChildren(node: ContainmentNode, cx: number, cy: number, r: number, depth: number): PackedCircle[] {
  if (node.children.length === 0) return []

  const totalSize = node.children.reduce((sum, child) => sum + child.size, 0)
  if (totalSize === 0) return []

  // Relative to the largest child, so one dominant child fills most of the parent.
  const largest = Math.max(...node.children.map((child) => child.size))
  const rawRadii = node.children.map((child) => Math.sqrt(child.size / largest))

  const centres = placeCircles(rawRadii, SIBLING_GAP)
  const bound = boundingRadius(centres, rawRadii)
  const scale = bound === 0 ? 0 : (r * CHILD_AREA) / bound

  const circles: PackedCircle[] = []
  node.children.forEach((child, i) => {
    const childR = rawRadii[i]! * scale
    const childX = cx + centres[i]!.x * scale
    const childY = cy + centres[i]!.y * scale

    circles.push({
      playlistId: child.playlistId,
      name: child.name,
      size: child.size,
      otherContainerCount: child.otherContainerCount,
      x: childX,
      y: childY,
      r: childR,
      depth,
      hasChildren: child.children.length > 0,
    })
    circles.push(...layoutChildren(child, childX, childY, childR, depth + 1))
  })

  return circles
}

/**
 * Packs a cluster's forest into a square viewport.
 *
 * Input: the cluster's roots, and the side length of the square to fill.
 * Output: circles ordered outermost first, in viewport coordinates.
 * Side effects: none.
 *
 * Roots are packed against each other exactly as siblings are, so a cluster with several roots
 * reads as several adjacent maps rather than needing a separate layout path.
 */
export function packCluster(roots: ContainmentNode[], side: number): PackedCircle[] {
  if (roots.length === 0 || side <= 0) return []

  const largest = Math.max(...roots.map((root) => root.size))
  if (largest === 0) return []

  const rawRadii = roots.map((root) => Math.sqrt(root.size / largest))
  const centres = placeCircles(rawRadii, SIBLING_GAP)
  const bound = boundingRadius(centres, rawRadii)

  // A small inset keeps the outermost stroke inside the viewBox.
  const scale = bound === 0 ? 0 : (side / 2 - 2) / bound
  const originX = side / 2
  const originY = side / 2

  const circles: PackedCircle[] = []
  roots.forEach((root, i) => {
    const r = rawRadii[i]! * scale
    const x = originX + centres[i]!.x * scale
    const y = originY + centres[i]!.y * scale

    circles.push({
      playlistId: root.playlistId,
      name: root.name,
      size: root.size,
      otherContainerCount: root.otherContainerCount,
      x,
      y,
      r,
      depth: 0,
      hasChildren: root.children.length > 0,
    })
    circles.push(...layoutChildren(root, x, y, r, 1))
  })

  return circles
}
