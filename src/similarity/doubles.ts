import {
  DURATION_TOLERANCE_MS,
  LOW_OVERLAP_THRESHOLD,
  MAX_BLOCK_SIZE,
  MAX_RESULT_ROWS,
  MIN_CROSS_ARTIST_TITLE_TOKENS,
  MODERATE_OVERLAP_THRESHOLD,
} from './constants'
import { isUnmatchable, normalizeArtist, normalizeTitle, parseDuration, tokenSetOverlap } from './normalize'
import type {
  CursorScope,
  DetectedGroup,
  DoublesControls,
  EquivalenceStatus,
  InvertedIndex,
  KnownGroup,
  MatchTier,
  ResultRow,
  ScanNote,
  ScanResult,
  TrackMatchInput,
} from './types'

/** Tier ordering, weakest first. Used to compare tiers and to find a group's weakest link. */
const TIER_ORDER: MatchTier[] = ['low', 'moderate', 'high', 'source']

/** Numeric rank of a tier, for comparison and for the sortable measure. */
export function tierRank(tier: MatchTier): number {
  return TIER_ORDER.indexOf(tier)
}

/** Human label for a tier, as the About page shows it. */
function tierLabel(tier: MatchTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

/** One track reduced to its matching keys, computed once per track rather than per comparison. */
interface Candidate {
  trackID: string
  title: string
  artist: string
  titleKey: string
  artistKey: string
  duration: number | null
}

/**
 * Scores one pair of candidates.
 *
 * Returns null when the pair is not a match at all. Duration agreement promotes the result by
 * exactly one tier, never to 'source' and never downward.
 *
 * A shared title across different artists is deliberately weak evidence. Measured against the real
 * export, "Words" by three artists and "Morning" by two are different songs, not variants of one
 * recording. So a cross-artist match needs a title of at least MIN_CROSS_ARTIST_TITLE_TOKENS words
 * to count at all, and lands at 'low' rather than 'moderate' unless the durations agree.
 */
export function scorePair(a: Candidate, b: Candidate): MatchTier | null {
  const sameArtist = a.artistKey === b.artistKey
  const sameTitle = a.titleKey === b.titleKey
  const overlap = sameTitle ? 1 : tokenSetOverlap(a.titleKey, b.titleKey)
  const titleTokens = a.titleKey.split(' ').filter(Boolean).length
  const crossArtistAllowed = titleTokens >= MIN_CROSS_ARTIST_TITLE_TOKENS

  let tier: MatchTier | null = null
  if (sameTitle && sameArtist) tier = 'high'
  else if (sameTitle && !sameArtist) tier = crossArtistAllowed ? 'low' : null
  else if (overlap >= MODERATE_OVERLAP_THRESHOLD && sameArtist) tier = 'moderate'
  else if (overlap >= LOW_OVERLAP_THRESHOLD && crossArtistAllowed) tier = 'low'

  if (tier === null) return null

  const durationsAgree =
    a.duration !== null &&
    b.duration !== null &&
    Math.abs(a.duration - b.duration) <= DURATION_TOLERANCE_MS

  if (durationsAgree) {
    if (tier === 'low') return 'moderate'
    if (tier === 'moderate') return 'high'
  }
  return tier
}

/** Disjoint-set forest. Gives transitivity without walking a graph. */
class UnionFind {
  private parent = new Map<string, string>()

  find(id: string): string {
    const seen = this.parent.get(id)
    if (seen === undefined) {
      this.parent.set(id, id)
      return id
    }
    if (seen === id) return id
    const root = this.find(seen)
    this.parent.set(id, root)
    return root
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootA, rootB)
  }
}

/**
 * Detects groups of tracks that are the same recording.
 *
 * Inputs: tracks reduced to their matching fields, and the groups already on record.
 * Output: newly detected groups, each carrying its weakest member tier.
 * Side effects: none beyond the notes array it appends to.
 *
 * Tracks already inside ANY stored group are skipped, whatever its review state. A confirmed or
 * rejected group must never be re-proposed, and an unconfirmed one is already stored and already
 * rendered from that record -- re-detecting it would duplicate both the row and the row's database
 * entry on every scan.
 */
export function detectGroups(
  tracks: TrackMatchInput[],
  known: KnownGroup[],
  notes: ScanNote[],
): DetectedGroup[] {
  const decided = new Set<string>()
  for (const group of known) {
    for (const id of group.trackIds) decided.add(id)
  }

  const candidates: Candidate[] = []
  let unmatchable = 0
  for (const track of tracks) {
    if (decided.has(track.trackID)) continue
    if (isUnmatchable(track.title, track.artist)) {
      unmatchable += 1
      continue
    }
    candidates.push({
      trackID: track.trackID,
      title: track.title,
      artist: track.artist,
      titleKey: normalizeTitle(track.title),
      artistKey: normalizeArtist(track.artist),
      duration: parseDuration(track.duration),
    })
  }

  if (unmatchable > 0) {
    notes.push({
      kind: 'unmatchable-tracks',
      message: `${unmatchable} track(s) skipped for missing or placeholder title and artist metadata.`,
      count: unmatchable,
    })
  }

  // Block by normalized title so the scan never compares every track against every other.
  const blocks = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const bucket = blocks.get(candidate.titleKey)
    if (bucket) bucket.push(candidate)
    else blocks.set(candidate.titleKey, [candidate])
  }

  const forest = new UnionFind()
  const pairTiers = new Map<string, MatchTier>()
  const oversized: string[] = []

  for (const [key, block] of blocks) {
    if (block.length < 2) continue
    if (block.length > MAX_BLOCK_SIZE) {
      oversized.push(key)
      continue
    }
    for (let i = 0; i < block.length; i += 1) {
      for (let j = i + 1; j < block.length; j += 1) {
        const tier = scorePair(block[i]!, block[j]!)
        if (!tier) continue
        forest.union(block[i]!.trackID, block[j]!.trackID)
        pairTiers.set(`${block[i]!.trackID}|${block[j]!.trackID}`, tier)
      }
    }
  }

  if (oversized.length > 0) {
    notes.push({
      kind: 'oversized-block',
      message: `${oversized.length} title group(s) over ${MAX_BLOCK_SIZE} tracks skipped as a metadata artifact: ${oversized.slice(0, 5).join(', ')}.`,
      count: oversized.length,
    })
  }

  const byRoot = new Map<string, string[]>()
  for (const candidate of candidates) {
    const root = forest.find(candidate.trackID)
    const bucket = byRoot.get(root)
    if (bucket) bucket.push(candidate.trackID)
    else byRoot.set(root, [candidate.trackID])
  }

  const groups: DetectedGroup[] = []
  for (const trackIds of byRoot.values()) {
    // A group of one is not a double.
    if (trackIds.length < 2) continue

    // The group is only as certain as its weakest pair.
    let weakest: MatchTier = 'source'
    for (let i = 0; i < trackIds.length; i += 1) {
      for (let j = i + 1; j < trackIds.length; j += 1) {
        const tier =
          pairTiers.get(`${trackIds[i]}|${trackIds[j]}`) ??
          pairTiers.get(`${trackIds[j]}|${trackIds[i]}`)
        if (tier && tierRank(tier) < tierRank(weakest)) weakest = tier
      }
    }
    groups.push({ trackIds, matchTier: weakest === 'source' ? 'high' : weakest })
  }

  return groups
}

/** A stored group joined with everything the result row needs to describe it. */
export interface ScannableGroup {
  id?: number
  trackIds: string[]
  matchTier: MatchTier
  status: EquivalenceStatus
  preferredTrackId?: string
}

/**
 * Turns groups into result rows.
 *
 * Inputs: groups to display, a lookup for track display fields, the inverted index for playlist
 * counts, live controls, and the cursor scope.
 * Output: rows in the shared ResultRow shape, so ResultTable renders them unchanged.
 * Side effects: none.
 *
 * A group is in scope when any of its tracks is: a playlist cursor keeps groups touching those
 * playlists, a track cursor keeps groups containing those tracks.
 */
export function buildDoublesRows(
  groups: ScannableGroup[],
  tracks: Map<string, TrackMatchInput>,
  index: InvertedIndex,
  controls: DoublesControls,
  scope: CursorScope,
  notes: ScanNote[],
): ScanResult {
  const scopedPlaylists =
    scope.subject === 'playlist' && scope.ids.length > 0 ? new Set(scope.ids.map(Number)) : null
  const scopedTracks =
    scope.subject === 'track' && scope.ids.length > 0 ? new Set(scope.ids) : null

  const rows: ResultRow[] = []
  let beforeFilter = 0

  for (const group of groups) {
    if (controls.reviewFilter !== 'all' && group.status !== controls.reviewFilter) continue
    if (tierRank(group.matchTier) < tierRank(controls.minTier)) continue

    const owningPlaylists = new Set<number>()
    for (const trackId of group.trackIds) {
      for (const playlistId of index.trackToPlaylists.get(trackId) ?? []) {
        owningPlaylists.add(playlistId)
      }
    }

    if (scopedTracks && !group.trackIds.some((id) => scopedTracks.has(id))) continue
    if (scopedPlaylists && ![...owningPlaylists].some((id) => scopedPlaylists.has(id))) continue

    beforeFilter += 1

    const anchorId = group.preferredTrackId ?? group.trackIds[0]!
    const anchor = tracks.get(anchorId)

    rows.push({
      key: group.id !== undefined ? `g${group.id}` : `t${group.trackIds.join('+')}`,
      subject: 'track',
      primaryLabel: anchor?.title ?? anchorId,
      secondaryLabel: anchor?.artist,
      measures: [
        {
          key: 'variants',
          label: 'Variants',
          value: group.trackIds.length,
          display: `${group.trackIds.length}`,
        },
        {
          key: 'playlists',
          label: 'Playlists',
          value: owningPlaylists.size,
          display: `${owningPlaylists.size}`,
        },
        {
          key: 'tier',
          label: 'Match',
          value: tierRank(group.matchTier),
          display: tierLabel(group.matchTier),
        },
      ],
      denominator: `${group.trackIds.length} variants across ${owningPlaylists.size} playlists`,
      memberIds: group.trackIds,
    })
  }

  notes.push({
    kind: 'pre-threshold-count',
    message: `${beforeFilter} doubles group(s) match the current filter.`,
    count: beforeFilter,
  })

  const direction = controls.sortDir === 'asc' ? 1 : -1
  const sortKey = rows[0]?.measures.some((m) => m.key === controls.sortKey)
    ? controls.sortKey
    : (rows[0]?.measures[0]?.key ?? 'variants')

  const sorted = [...rows].sort((a, b) => {
    const av = a.measures.find((m) => m.key === sortKey)?.value ?? 0
    const bv = b.measures.find((m) => m.key === sortKey)?.value ?? 0
    return (av - bv) * direction
  })

  if (sorted.length > MAX_RESULT_ROWS) {
    notes.push({
      kind: 'truncated-rows',
      message: `Showing the top ${MAX_RESULT_ROWS} of ${sorted.length} groups. Narrow the review filter to see fewer.`,
      count: sorted.length,
    })
    return { rows: sorted.slice(0, MAX_RESULT_ROWS), notes }
  }

  return { rows: sorted, notes }
}
