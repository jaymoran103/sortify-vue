import type { ContainmentNode } from './containment'

/**
 * Circle packing for the containment map.
 *
 * Full containment means a Venn diagram degenerates into nested circles: there are no partial
 * overlap crescents to draw, because an inner playlist's tracks are entirely inside the outer's.
 * That makes concentric circles the honest primitive, and the layout a packing problem rather
 * than a set-geometry one.
 *
 * Sizes are laid out in track-root units — a radius of sqrt(tracks) — so a circle's AREA is its
 * track count. The finished arrangement is measured once and scaled to the viewport by a single
 * factor, which keeps area comparable between any two circles on the map, at any depth, in any
 * container. An earlier version rescaled each sibling group to fit its parent, which drew well but
 * meant no two circles could be compared unless they shared a parent.
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
  /**
   * Radius the track count alone calls for, in viewport units. Equal to `r` for most circles; on
   * an inflated container it is smaller, and marks where the honest edge would have fallen.
   */
  trueR: number
  /** Whether the contents forced this circle wider than its own track count warrants. */
  inflated: boolean
  /** 0 for a cluster root, 1 for its children, and so on. Drives styling, not geometry. */
  depth: number
  /**
   * Whether anything is nested inside. A container's interior belongs to its children, so its
   * label goes on the rim; a leaf can use its middle.
   */
  hasChildren: boolean
}

/** A laid-out cluster, plus the scale that produced it. */
export interface PackedMap {
  circles: PackedCircle[]
  /**
   * Viewport radius per sqrt(track): `scale * Math.sqrt(size)` is the radius any playlist of that
   * size is drawn at. The view uses it to draw a calibration key at the same scale as the data.
   */
  scale: number
}

/**
 * How much wider than its contents a container is drawn, when its contents are the binding
 * constraint. The surplus is the ring its own label sits in.
 *
 * Circles cannot tile a circle — a dozen equal circles fill at best about 74% of their enclosure —
 * so a container whose children cover most of its tracks cannot also be drawn at its true area.
 * Those containers are marked rather than quietly resized, and the ring keeps the label off them.
 */
const CONTENT_MARGIN = 1.08

/** Gap between siblings, in track-root units. Keeps adjacent edges from visually merging. */
const SIBLING_GAP = 0.1

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

/** A node sized in track-root units, with each child's offset from its own centre. */
interface Sized {
  node: ContainmentNode
  r: number
  trueR: number
  children: { sized: Sized; dx: number; dy: number }[]
}

/**
 * Sizes a subtree bottom-up, in track-root units.
 *
 * A node wants a radius of sqrt(tracks), so its area is its track count. It gets that unless its
 * own contents need more room, in which case the contents win and the node is drawn wider than its
 * count — recorded as `trueR` so the view can show what was given up.
 */
function sizeSubtree(node: ContainmentNode): Sized {
  const trueR = Math.sqrt(node.size)
  if (node.children.length === 0) return { node, r: trueR, trueR, children: [] }

  // Largest first, which is the order the greedy packer expects.
  const sized = [...node.children].sort((a, b) => b.size - a.size).map(sizeSubtree)
  const radii = sized.map((child) => child.r)
  const centres = placeCircles(radii, SIBLING_GAP)
  const enclosing = boundingRadius(centres, radii)

  return {
    node,
    r: Math.max(trueR, enclosing * CONTENT_MARGIN),
    trueR,
    children: sized.map((child, i) => ({ sized: child, dx: centres[i]!.x, dy: centres[i]!.y })),
  }
}

/** Walks a sized subtree into viewport circles, parents before children. */
function emitCircles(
  sized: Sized,
  cx: number,
  cy: number,
  scale: number,
  depth: number,
  out: PackedCircle[],
): void {
  const { node } = sized
  out.push({
    playlistId: node.playlistId,
    name: node.name,
    size: node.size,
    otherContainerCount: node.otherContainerCount,
    x: cx,
    y: cy,
    r: sized.r * scale,
    trueR: sized.trueR * scale,
    inflated: sized.r > sized.trueR + 1e-9,
    depth,
    hasChildren: node.children.length > 0,
  })

  for (const child of sized.children) {
    emitCircles(child.sized, cx + child.dx * scale, cy + child.dy * scale, scale, depth + 1, out)
  }
}

/**
 * Packs a cluster's forest into a square viewport.
 *
 * Input: the cluster's roots, and the side length of the square to fill.
 * Output: circles ordered outermost first in viewport coordinates, and the scale that sized them.
 * Side effects: none.
 *
 * Roots are packed against each other exactly as siblings are, so a cluster with several roots
 * reads as several adjacent maps rather than needing a separate layout path. The fit-to-viewport
 * step is one multiplication applied to every circle, which is what keeps areas comparable.
 */
export function packCluster(roots: ContainmentNode[], side: number): PackedMap {
  const empty: PackedMap = { circles: [], scale: 0 }
  if (roots.length === 0 || side <= 0) return empty

  const sized = [...roots].sort((a, b) => b.size - a.size).map(sizeSubtree)
  const radii = sized.map((root) => root.r)
  const centres = placeCircles(radii, SIBLING_GAP)
  const bound = boundingRadius(centres, radii)
  if (bound === 0) return empty

  // A small inset keeps the outermost stroke inside the viewBox.
  const scale = (side / 2 - 2) / bound
  const circles: PackedCircle[] = []
  sized.forEach((root, i) => {
    const cx = side / 2 + centres[i]!.x * scale
    const cy = side / 2 + centres[i]!.y * scale
    emitCircles(root, cx, cy, scale, 0, circles)
  })

  return { circles, scale }
}
