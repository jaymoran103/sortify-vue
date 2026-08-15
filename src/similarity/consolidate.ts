/**
 * Consolidation: rewriting playlists to keep one variant of each confirmed doubles group.
 *
 * This is the module's only destructive path. Everything else resolves equivalence at read time,
 * so the computation lives here as a pure function and the caller owns the confirmation and the
 * write. That separation is what makes the dangerous part testable without a database.
 */

/** The narrowest playlist shape a rewrite needs. */
export interface ConsolidatablePlaylist {
  id: number
  name: string
  trackIDs: string[]
}

/** A confirmed group and the variant to keep. */
export interface ConsolidationGroup {
  trackIds: string[]
  preferredTrackId: string
}

/** One playlist's rewritten contents, plus what changed. */
export interface PlaylistRewrite {
  id: number
  name: string
  trackIDs: string[]
  replaced: number
  removed: number
}

/** What a consolidation would do, computed before anything is written. */
export interface ConsolidationPlan {
  rewrites: PlaylistRewrite[]
  totalReplaced: number
  totalRemoved: number
  playlistCount: number
}

/**
 * Computes what consolidating would change, without changing anything.
 *
 * Inputs: the playlists in scope, and the confirmed groups to apply.
 * Output: one rewrite per playlist that would actually change, plus totals for the confirm dialog.
 * Side effects: none.
 *
 * Track order is preserved: a non-preferred variant is replaced in place rather than appended, so
 * a consolidated playlist still reads in the order the user built it. When a playlist already
 * holds the preferred variant, the redundant one is dropped instead of duplicated, and counted
 * under `removed` so the confirm dialog can be honest about it.
 */
export function planConsolidation(
  playlists: ConsolidatablePlaylist[],
  groups: ConsolidationGroup[],
): ConsolidationPlan {
  // trackId -> the variant that should survive. Only non-preferred variants appear as keys.
  const replacement = new Map<string, string>()
  for (const group of groups) {
    for (const trackId of group.trackIds) {
      if (trackId !== group.preferredTrackId) replacement.set(trackId, group.preferredTrackId)
    }
  }

  if (replacement.size === 0) {
    return { rewrites: [], totalReplaced: 0, totalRemoved: 0, playlistCount: 0 }
  }

  const rewrites: PlaylistRewrite[] = []
  let totalReplaced = 0
  let totalRemoved = 0

  for (const playlist of playlists) {
    const seen = new Set<string>()
    const next: string[] = []
    let replaced = 0
    let removed = 0

    for (const trackId of playlist.trackIDs) {
      const preferred = replacement.get(trackId)
      const resolved = preferred ?? trackId

      if (seen.has(resolved)) {
        // The preferred variant is already in this playlist, so this entry is redundant.
        removed += 1
        continue
      }

      seen.add(resolved)
      next.push(resolved)
      if (preferred) replaced += 1
    }

    if (replaced === 0 && removed === 0) continue

    rewrites.push({ id: playlist.id, name: playlist.name, trackIDs: next, replaced, removed })
    totalReplaced += replaced
    totalRemoved += removed
  }

  return {
    rewrites,
    totalReplaced,
    totalRemoved,
    playlistCount: rewrites.length,
  }
}

/**
 * Builds the sentence shown in the confirmation dialog.
 *
 * Names real numbers rather than "some entries", because this is the one action in the module the
 * user cannot undo, and a vague warning is not informed consent.
 */
export function describeConsolidation(plan: ConsolidationPlan): string {
  if (plan.playlistCount === 0) return 'Nothing to consolidate in the selected playlists.'

  const parts: string[] = []
  if (plan.totalReplaced > 0) {
    parts.push(`replace ${plan.totalReplaced} track entr${plan.totalReplaced === 1 ? 'y' : 'ies'}`)
  }
  if (plan.totalRemoved > 0) {
    parts.push(`remove ${plan.totalRemoved} now-redundant entr${plan.totalRemoved === 1 ? 'y' : 'ies'}`)
  }

  const playlists = `${plan.playlistCount} playlist${plan.playlistCount === 1 ? '' : 's'}`
  return `This will ${parts.join(' and ')} across ${playlists}. This cannot be undone.`
}
