/**
 * Shared types for the similarity module.
 *
 * Everything here is structured-clone safe, because these shapes cross the Web Worker boundary.
 * Maps and Sets are cloneable; class instances and functions are not, so none appear below.
 */

/** What a selection refers to. Playlists and tracks are the only two subjects the module scans. */
export type CursorSubject = 'playlist' | 'track'

/**
 * A scan's scope, read from the app-wide cursor.
 * A null subject means an empty cursor, which means the whole library.
 */
export interface CursorScope {
  subject: CursorSubject | null
  ids: string[]
}

/**
 * The narrowest playlist shape the index needs.
 * Deliberately smaller than Playlist so the worker payload carries no URIs or timestamps.
 */
export interface IndexInput {
  id: number
  name: string
  trackIDs: string[]
}

/**
 * The inverted index every scan reads.
 *
 * playlistSizes holds unique counts and drives all similarity math. rawSizes holds the original
 * trackIDs length so a playlist carrying duplicate entries can disclose the difference rather
 * than silently disagreeing with the counts the dashboard shows.
 */
export interface InvertedIndex {
  trackToPlaylists: Map<string, number[]>
  playlistSets: Map<number, Set<string>>
  playlistSizes: Map<number, number>
  rawSizes: Map<number, number>
  playlistNames: Map<number, string>
  builtAt: number
}

/** Summary of a built index, reported back to the main thread for display. */
export interface IndexStats {
  playlistCount: number
  uniqueTrackCount: number
  builtAt: number
}

/** Confidence that two tracks are the same recording. */
export type MatchTier = 'source' | 'high' | 'moderate' | 'low'

/** Review state of a detected group. Rejections persist so a rescan never re-proposes them. */
export type EquivalenceStatus = 'unconfirmed' | 'confirmed' | 'rejected'

/** The narrowest track shape matching needs, keeping the worker payload small. */
export interface TrackMatchInput {
  trackID: string
  title: string
  artist: string
  duration?: number | string
}

/** A group already on record, so a rescan can skip its tracks. */
export interface KnownGroup {
  trackIds: string[]
  status: EquivalenceStatus
}

/** Live control values for a doubles scan. */
export interface DoublesControls {
  reviewFilter: EquivalenceStatus | 'all'
  minTier: MatchTier
  sortKey: string
  sortDir: 'asc' | 'desc'
}

/** A detected group, before it reaches the database. */
export interface DetectedGroup {
  trackIds: string[]
  matchTier: MatchTier
  preferredTrackId?: string
}

/** Which measure a threshold gates on. */
export type OverlapMeasureKey = 'jaccard' | 'containment' | 'ratio'

/**
 * Live control values for a scan.
 *
 * sortKey must name a measure present on the rows the scan produces. Nothing is sortable that is
 * not also visible as a column, which is what stops a result being ranked by something unseen.
 */
export interface OverlapControls {
  axis: CursorSubject
  measure: OverlapMeasureKey
  threshold: number
  sortKey: string
  sortDir: 'asc' | 'desc'
}

/** One numeric column on a result row. A bar renders only where bar is present. */
export interface ResultMeasure {
  key: string
  label: string
  value: number
  display: string
  bar?: number
}

/**
 * One row of any similarity result.
 *
 * Columns derive from measures, so a second operation reuses the same table by supplying
 * different measures. denominator is mandatory: every ranked row explaining itself in one
 * sentence is what makes the explainability rule enforceable rather than aspirational.
 */
export interface ResultRow {
  key: string
  subject: CursorSubject
  primaryLabel: string
  secondaryLabel?: string
  sizeTitle?: string
  measures: ResultMeasure[]
  denominator: string
  memberIds: string[]
}

/** Categories of scan disclosure. Every exclusion a scan makes gets one of these. */
export type ScanNoteKind =
  | 'pre-threshold-count'
  | 'excluded-playlists'
  | 'raised-degree'
  | 'truncated-rows'
  | 'unmatchable-tracks'
  | 'oversized-block'

/** A statement about what a scan did or declined to do, rendered above the result. */
export interface ScanNote {
  kind: ScanNoteKind
  message: string
  count?: number
}

/** What a scan returns: the rows, plus everything it needs to disclose about them. */
export interface ScanResult {
  rows: ResultRow[]
  notes: ScanNote[]
}

/**
 * A named set of control values, and nothing else.
 *
 * The absence of any field that could hold code is deliberate: a preset needing new code is not
 * a preset, it is a third operation, which is an architectural event rather than a config change.
 */
export interface OverlapPreset {
  key: string
  label: string
  aliases: string[]
  controls: OverlapControls
}

/** The two track fields row labelling needs. Kept minimal so titles never enter the worker. */
export interface TrackLabelInput {
  title: string
  artist: string
}

// Type-only, so the cycle with containment.ts (which imports InvertedIndex from here) is erased
// at compile time and never reaches the bundle.
import type { ContainmentCluster } from './containment'

/** Re-exported so callers can name the worker protocol's payload from one place. */
export type { ContainmentCluster, ContainmentNode } from './containment'

/** Main thread to worker. The id correlates a request with its response. */
export type ScanRequest =
  | { id: number; type: 'build'; playlists: IndexInput[]; canonical?: [string, string][] }
  | { id: number; type: 'scan'; controls: OverlapControls; scope: CursorScope }
  | { id: number; type: 'containment' }
  | {
      id: number
      type: 'doubles'
      tracks: TrackMatchInput[]
      known: KnownGroup[]
      stored: StoredGroupInput[]
      controls: DoublesControls
      scope: CursorScope
    }

/** Worker to main thread. Progress may arrive many times before a result or an error. */
/** A stored group as the worker needs it, without the timestamps only the UI uses. */
export interface StoredGroupInput {
  id?: number
  trackIds: string[]
  matchTier: MatchTier
  status: EquivalenceStatus
  preferredTrackId?: string
}

export type ScanResponse =
  | { id: number; type: 'built'; stats: IndexStats }
  | { id: number; type: 'detected'; groups: DetectedGroup[]; result: ScanResult }
  | { id: number; type: 'clusters'; clusters: ContainmentCluster[] }
  | { id: number; type: 'progress'; done: number; total: number; phase: string }
  | { id: number; type: 'result'; result: ScanResult }
  | { id: number; type: 'error'; message: string }
