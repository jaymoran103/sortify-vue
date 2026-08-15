/**
 * Title and artist normalization for double detection.
 *
 * Everything here is pure and string-only, so it is cheap enough to run over every track in the
 * library inside the worker. The rules are deliberately conservative: they strip the decorations
 * that distinguish releases of the same recording, and nothing else. Over-normalizing collapses
 * genuinely different songs, which is far worse than missing a variant.
 */

/**
 * Words that mark a release variant rather than a different recording.
 * Matched inside a trailing " - ..." segment or a parenthesised/bracketed segment.
 */
const VERSION_WORDS = [
  'remaster',
  'remastered',
  'remastered version',
  'live',
  'mono',
  'stereo',
  'radio edit',
  'single version',
  'album version',
  'deluxe',
  'deluxe edition',
  'bonus track',
  'expanded',
  'anniversary edition',
  'original mix',
  're-recorded',
  'rerecorded',
  "taylor's version",
]

/** Credit markers. Everything from here on names a guest, not the recording. */
const FEATURE_MARKERS = ['feat.', 'feat ', 'ft.', 'ft ', 'featuring ', 'with ']

/** Separators that introduce a secondary artist rather than part of the primary name. */
const ARTIST_SEPARATORS = [',', '&', ' and ', ' x ', ' with ']

/** True when a segment is a version marker rather than part of the title. */
function isVersionSegment(segment: string): boolean {
  const lower = segment.toLowerCase().trim()
  if (lower.length === 0) return false
  // Year-prefixed forms such as "2005 Remaster" or "2011 Remastered Version".
  const withoutYear = lower.replace(/^(19|20)\d{2}\s+/, '')
  return VERSION_WORDS.some((word) => withoutYear === word || withoutYear.startsWith(`${word} `)) ||
    VERSION_WORDS.some((word) => withoutYear.endsWith(word)) ||
    FEATURE_MARKERS.some((marker) => lower.startsWith(marker.trim()))
}

/**
 * Strips punctuation and collapses whitespace. Runs last, after structural stripping.
 *
 * Apostrophes are elided rather than replaced with a space, so "don't" becomes "dont" and not
 * "don t". Every other punctuation mark becomes a space, so "AC/DC" becomes "ac dc" — two tokens,
 * which is what token overlap wants.
 */
function tidy(value: string): string {
  return value
    .replace(/['‘’ʼ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reduces a track title to the recording it names.
 *
 * Input: a raw title such as "Respect - 2005 Remaster" or "Sunny (feat. Connor Price)".
 * Output: a lowercase, punctuation-free key such as "respect" or "sunny".
 * Side effects: none.
 */
export function normalizeTitle(title: string): string {
  let working = title

  // Trailing " - <version>" segments. Only the trailing one, and only when it reads as a version
  // marker, so "Hyphenated - Real Title" survives intact.
  const dashIndex = working.lastIndexOf(' - ')
  if (dashIndex > 0 && isVersionSegment(working.slice(dashIndex + 3))) {
    working = working.slice(0, dashIndex)
  }

  // Parenthesised and bracketed segments, but only version or credit ones. A title like
  // "(Don't Fear) The Reaper" keeps its parenthetical because it is neither.
  working = working.replace(/[([]([^)\]]*)[)\]]/g, (whole, inner: string) =>
    isVersionSegment(inner) ? ' ' : whole,
  )

  return tidy(working.toLowerCase())
}

/**
 * Reduces an artist credit to its primary artist.
 *
 * Input: a raw credit such as "Boney M., Connor Price" or "The Beatles".
 * Output: a lowercase key such as "boney m" or "beatles".
 * Side effects: none.
 *
 * Keeping only the primary artist is what lets a track credited to a duo match the same recording
 * credited to the lead alone, which is a real pattern in Spotify exports.
 */
export function normalizeArtist(artist: string): string {
  let working = artist.toLowerCase()

  for (const marker of FEATURE_MARKERS) {
    const index = working.indexOf(marker)
    if (index > 0) working = working.slice(0, index)
  }

  for (const separator of ARTIST_SEPARATORS) {
    const index = working.indexOf(separator)
    if (index > 0) working = working.slice(0, index)
  }

  working = working.replace(/^the\s+/, '')
  return tidy(working)
}

/**
 * Token-set overlap between two normalized strings, as a 0..1 ratio.
 *
 * Uses the smaller token set as the denominator, so a short title fully contained in a longer one
 * scores 1. That is the behaviour double detection wants: "Respect" inside "Respect Reprise" is a
 * strong signal, where a symmetric measure would score it weakly.
 */
export function tokenSetOverlap(a: string, b: string): number {
  const left = new Set(a.split(' ').filter(Boolean))
  const right = new Set(b.split(' ').filter(Boolean))
  if (left.size === 0 || right.size === 0) return 0

  let shared = 0
  for (const token of left) {
    if (right.has(token)) shared += 1
  }
  return shared / Math.min(left.size, right.size)
}

/**
 * True when a track carries metadata too degraded to match on.
 *
 * Real exports contain rows whose title and artist are the literal string "undefined". Without
 * this guard they all match each other at the highest tier and swamp the result.
 */
export function isUnmatchable(title: string, artist: string): boolean {
  const normalizedTitle = normalizeTitle(title)
  const normalizedArtist = normalizeArtist(artist)
  if (normalizedTitle.length === 0) return true
  return normalizedTitle === 'undefined' || normalizedArtist === 'undefined'
}

/**
 * Parses a duration that may arrive as a number or a numeric string.
 * Returns null for anything not a finite positive number, so callers never compare garbage.
 */
export function parseDuration(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
