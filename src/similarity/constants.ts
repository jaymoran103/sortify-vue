/**
 * Tuning constants for similarity scans.
 *
 * The track-axis ceilings exist because that axis has a different cost shape from the playlist
 * axis. Playlist-axis cost is bounded by pairs that actually co-occur; track-axis cost is the sum
 * of C(n, 2) over playlists, so one very large playlist can dominate everything else. Each ceiling
 * below is a stated exclusion that the scan reports, never a silent cap.
 */

/**
 * Playlists larger than this are excluded from track-axis pair generation and named in the result.
 * A catch-all playlist makes every track in it look like it travels with every other track, so
 * excluding it improves the answer as well as the runtime.
 */
export const TRACK_AXIS_MAX_SIZE = 250

/** Pair-map ceiling. Exceeding it raises the degree floor and restarts the accumulation. */
export const TRACK_AXIS_MAX_PAIRS = 2_000_000

/** How many times the degree floor may raise before the scan accepts the result as is. */
export const TRACK_AXIS_MAX_DEGREE_RAISES = 4

/**
 * Maximum rows any scan emits, applied after sorting so the most relevant survive.
 *
 * The pair ceilings above bound what a scan computes; this bounds what it hands back. A worst-case
 * track-axis scan can produce a few hundred thousand qualifying pairs, and every row is
 * structured-cloned across the worker boundary and held in memory by the view. Truncation is
 * always reported in a scan note, and no user can act on the two-hundred-thousandth row anyway.
 */
export const MAX_RESULT_ROWS = 5000

/** Cold-load threshold: low enough that the page opens with rows rather than an empty state. */
export const DEFAULT_JACCARD_THRESHOLD = 0.1

/** Where two playlists stop being "related" and start being "the same playlist twice". */
export const NEAR_IDENTICAL_THRESHOLD = 0.7

/** Co-occurrence ratio at which two tracks read as a pair rather than a coincidence. */
export const ALWAYS_TOGETHER_THRESHOLD = 0.9

/**
 * Doubles detection thresholds.
 *
 * Candidates are blocked by normalized title, so only tracks sharing a title key are ever compared.
 * A block larger than this is skipped and named in a scan note: a title shared by hundreds of
 * tracks is a metadata artifact, not a set of variants.
 */
export const MAX_BLOCK_SIZE = 200

/** Two durations this close are treated as the same recording, promoting the match by one tier. */
export const DURATION_TOLERANCE_MS = 2000

/** Token-set overlap at or above this, with a matching artist, reads as a moderate match. */
export const MODERATE_OVERLAP_THRESHOLD = 0.8

/** Token-set overlap at or above this, with a differing artist, reads as a low match. */
export const LOW_OVERLAP_THRESHOLD = 0.6
