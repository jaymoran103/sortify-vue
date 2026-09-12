import type { InvertedIndex } from './types'

/**
 * Containment structure: which playlists are wholly inside which others.
 *
 * Overlap already reports containment as a measure, but only as prose on the row
 * ("X is 100% inside Y"). A visualisation needs the direction as data, which is what this module
 * produces. Everything here is pure, so the whole thing unit-tests without a DOM or a worker.
 */

/** One playlist in the containment forest, with whatever it wholly contains beneath it. */
export interface ContainmentNode {
  playlistId: number
  name: string
  /** Unique track count. Sizes drive circle areas, so this is the deduped figure. */
  size: number
  children: ContainmentNode[]
  /**
   * How many containers hold this playlist besides the one it is drawn under.
   * Non-zero means the tree is a simplification, and the view says so rather than hiding it.
   */
  otherContainerCount: number
}

/** A connected group of nesting relationships, drawn as one map. */
export interface ContainmentCluster {
  key: string
  roots: ContainmentNode[]
  /** Every playlist in the cluster, roots included. */
  playlistCount: number
  /** Longest chain of strict containment, so 1 means no nesting at all. */
  depth: number
  /** Playlists in this cluster held by more than one container. */
  multiParentCount: number
  /** Tracks of the roots accounted for by their descendants, and the roots' own total. */
  coveredTracks: number
  totalTracks: number
}

/** A strict containment edge. Identical playlists are excluded; see findContainmentPairs. */
export interface ContainmentPair {
  innerId: number
  outerId: number
}

/**
 * Finds every strict containment relationship in the library.
 *
 * Input: a built inverted index.
 * Output: pairs where the inner playlist's tracks are all present in the outer, and the outer is
 * strictly larger.
 * Side effects: none.
 *
 * Playlists of identical size that contain each other are deliberately excluded: that is mutual
 * equivalence, not nesting, and drawing one inside the other would assert a hierarchy that does
 * not exist. Overlap's result table already surfaces those as 100% pairs.
 *
 * Candidate containers are drawn from the inverted index rather than tested pairwise across the
 * whole library: any container of P must contain every track of P, so the owners of P's rarest
 * track are the only possibilities. On the sample library that turns 82k pair tests into a few
 * hundred.
 */
export function findContainmentPairs(index: InvertedIndex): ContainmentPair[] {
  const pairs: ContainmentPair[] = []

  for (const [innerId, innerSet] of index.playlistSets) {
    if (innerSet.size === 0) continue

    // The rarest track prunes hardest, and any true container must own it.
    let rarest: string | null = null
    let rarestOwners = Number.POSITIVE_INFINITY
    for (const trackId of innerSet) {
      const owners = index.trackToPlaylists.get(trackId)?.length ?? 0
      if (owners < rarestOwners) {
        rarestOwners = owners
        rarest = trackId
      }
    }
    if (rarest === null) continue

    for (const outerId of index.trackToPlaylists.get(rarest) ?? []) {
      if (outerId === innerId) continue
      const outerSet = index.playlistSets.get(outerId)
      if (!outerSet || outerSet.size <= innerSet.size) continue

      let contained = true
      for (const trackId of innerSet) {
        if (!outerSet.has(trackId)) {
          contained = false
          break
        }
      }
      if (contained) pairs.push({ innerId, outerId })
    }
  }

  return pairs
}

/**
 * Groups containment relationships into clusters, each a forest fit to draw as nested circles.
 *
 * Input: a built inverted index.
 * Output: clusters ordered for display — deepest first, then fewest multi-parent complications,
 * then largest. That ordering puts genuinely concentric, cleanly nested groups in front of
 * tangled ones.
 * Side effects: none.
 *
 * A playlist held by several containers is drawn under its **smallest** container only, so the
 * result is a tree rather than a graph. The smallest container is the tightest true statement
 * about where it sits, and the node keeps a count of the containers it was not drawn under so the
 * view can disclose the simplification.
 */
export function buildContainmentClusters(index: InvertedIndex): ContainmentCluster[] {
  const pairs = findContainmentPairs(index)
  if (pairs.length === 0) return []

  const sizeOf = (id: number): number => index.playlistSizes.get(id) ?? 0

  // inner -> every container holding it
  const containers = new Map<number, number[]>()
  for (const pair of pairs) {
    containers.set(pair.innerId, [...(containers.get(pair.innerId) ?? []), pair.outerId])
  }

  // Each child is drawn under one parent: the smallest container that holds it.
  const primaryParent = new Map<number, number>()
  for (const [innerId, outerIds] of containers) {
    let best = outerIds[0]!
    for (const outerId of outerIds) {
      if (sizeOf(outerId) < sizeOf(best)) best = outerId
    }
    primaryParent.set(innerId, best)
  }

  const childrenOf = new Map<number, number[]>()
  for (const [innerId, parentId] of primaryParent) {
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), innerId])
  }

  // Connected components over the primary-parent edges.
  const neighbours = new Map<number, Set<number>>()
  const connect = (a: number, b: number): void => {
    if (!neighbours.has(a)) neighbours.set(a, new Set())
    if (!neighbours.has(b)) neighbours.set(b, new Set())
    neighbours.get(a)!.add(b)
    neighbours.get(b)!.add(a)
  }
  for (const [innerId, parentId] of primaryParent) connect(innerId, parentId)

  const buildNode = (playlistId: number): ContainmentNode => {
    const held = containers.get(playlistId)?.length ?? 0
    return {
      playlistId,
      name: index.playlistNames.get(playlistId) ?? String(playlistId),
      size: sizeOf(playlistId),
      // Largest first, so packing places the dominant child before the crumbs.
      children: (childrenOf.get(playlistId) ?? [])
        .sort((a, b) => sizeOf(b) - sizeOf(a))
        .map(buildNode),
      otherContainerCount: Math.max(0, held - 1),
    }
  }

  const depthOf = (node: ContainmentNode): number =>
    node.children.length === 0 ? 1 : 1 + Math.max(...node.children.map(depthOf))

  const countNodes = (node: ContainmentNode): number =>
    1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)

  const countMultiParent = (node: ContainmentNode): number =>
    (node.otherContainerCount > 0 ? 1 : 0) +
    node.children.reduce((sum, child) => sum + countMultiParent(child), 0)

  const seen = new Set<number>()
  const clusters: ContainmentCluster[] = []

  for (const start of neighbours.keys()) {
    if (seen.has(start)) continue

    const group: number[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length > 0) {
      const current = stack.pop()!
      group.push(current)
      for (const next of neighbours.get(current) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        stack.push(next)
      }
    }

    const roots = group
      .filter((id) => !primaryParent.has(id))
      .sort((a, b) => sizeOf(b) - sizeOf(a))
      .map(buildNode)
    if (roots.length === 0) continue

    const totalTracks = roots.reduce((sum, root) => sum + root.size, 0)
    const coveredTracks = roots.reduce(
      (sum, root) => sum + root.children.reduce((inner, child) => inner + child.size, 0),
      0,
    )

    clusters.push({
      key: `cluster-${Math.min(...group)}`,
      roots,
      playlistCount: roots.reduce((sum, root) => sum + countNodes(root), 0),
      depth: Math.max(...roots.map(depthOf)),
      multiParentCount: roots.reduce((sum, root) => sum + countMultiParent(root), 0),
      coveredTracks,
      totalTracks,
    })
  }

  // Deepest first, then cleanest, then biggest: concentric and untangled groups lead.
  return clusters.sort(
    (a, b) =>
      b.depth - a.depth ||
      a.multiParentCount - b.multiParentCount ||
      b.playlistCount - a.playlistCount,
  )
}
