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

/** Cold-load threshold: low enough that the page opens with rows rather than an empty state. */
export const DEFAULT_JACCARD_THRESHOLD = 0.1

/** Where two playlists stop being "related" and start being "the same playlist twice". */
export const NEAR_IDENTICAL_THRESHOLD = 0.7

/** Co-occurrence ratio at which two tracks read as a pair rather than a coincidence. */
export const ALWAYS_TOGETHER_THRESHOLD = 0.9
