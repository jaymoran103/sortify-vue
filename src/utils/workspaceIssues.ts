import type { WorkspaceIssue, WorkspaceSnapshot } from '@/types/ui'

/**
 * Join names into a readable list, naming at most `max` of them.
 *
 * Inputs: display names (already unquoted), and how many to name before summarising.
 * Output: `"A"`, `"A" and "B"`, `"A", "B" and "C"`, or `"A", "B", "C" and 4 more`.
 * No side effects.
 *
 * Exists because both rules below name things, and an unbounded list turns a warning into
 * a wall of text — the empty-playlist clause did exactly that before this.
 */
export function formatNameList(names: string[], max = 3): string {
  const quoted = names.map((name) => `"${name}"`)
  if (quoted.length === 0) return ''
  if (quoted.length === 1) return quoted[0]!

  if (quoted.length <= max) {
    const last = quoted[quoted.length - 1]!
    return `${quoted.slice(0, -1).join(', ')} and ${last}`
  }

  return `${quoted.slice(0, max).join(', ')} and ${quoted.length - max} more`
}

/**
 * Report every condition of the workspace worth telling the user about.
 *
 * Input: a plain snapshot of workspace state — no store, no reactivity, so this stays
 * directly unit-testable. Output: issues ordered loss-first. No side effects.
 *
 * Severity describes the condition, not where it is shown. Consumers decide that: the leave
 * guard blocks on 'loss' and prints 'quality' as a footnote, the column header renders its
 * own marker. Adding a check means editing this function and nothing else.
 */
export function collectWorkspaceIssues(snapshot: WorkspaceSnapshot): WorkspaceIssue[] {
  const { playlists, modifiedIds, stableOrder, tracks } = snapshot
  const issues: WorkspaceIssue[] = []

  if (modifiedIds.size > 0) {
    issues.push({
      code: 'unsaved-changes',
      severity: 'loss',
      message: 'You have unsaved changes.',
      ids: [...modifiedIds].map(String),
    })
  }

  // Tracks in the workspace but in no playlist. WorkspaceSession persists only playlistIds,
  // so these live in the in-memory buffer alone and cannot survive a reload — saving does not
  // rescue them, which is why the wording is unconditional (design decision D6).
  const unassigned = stableOrder.filter((id) => !playlists.some((pl) => pl.trackIdSet.has(id)))
  if (unassigned.length > 0) {
    // Fall back to the raw id if a record is missing, so the list never silently shrinks.
    const names = unassigned.map((id) => tracks.get(id)?.title ?? id)
    issues.push({
      code: 'unassigned-tracks',
      severity: 'loss',
      message:
        unassigned.length === 1
          ? `${formatNameList(names)} is in no playlist and will be discarded.`
          : `${formatNameList(names)} are in no playlist and will be discarded.`,
      ids: unassigned,
    })
  }

  // Every empty playlist, not only ones this session touched. The old guard excluded
  // untouched ones because the warning blocked the exit; as an advisory it no longer does,
  // and scoping it would disagree with the always-on column header marker.
  const empty = playlists.filter((pl) => pl.trackIDs.length === 0)
  if (empty.length > 0) {
    const names = empty.map((pl) => pl.name)
    issues.push({
      code: 'empty-playlist',
      severity: 'quality',
      message:
        empty.length === 1
          ? `${formatNameList(names)} has no tracks.`
          : `${formatNameList(names)} have no tracks.`,
      ids: empty.map((pl) => String(pl.id)),
    })
  }

  return issues
}
