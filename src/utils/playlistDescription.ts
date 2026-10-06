import type { Playlist } from '@/types/models'

// The hosted app. Every exported playlist links back here unless the user picks otherwise.
export const SORTIFY_SITE_URL = 'https://jaymoran103.github.io/sortify-vue'
export const DEFAULT_DESCRIPTION = SORTIFY_SITE_URL

// Spotify rejects longer descriptions and strips line breaks, so both are handled here
// rather than left to fail mid-export.
export const MAX_DESCRIPTION_LENGTH = 300

/**
 * Where an exported playlist's description comes from.
 * - 'site':     the Sortify link only
 * - 'playlist': the playlist's own description, or the Sortify link when it has none
 * - 'custom':   one text, the same for every playlist in the export
 */
export type DescriptionMode = 'site' | 'playlist' | 'custom'

export interface DescriptionOptions {
  mode: DescriptionMode
  customText?: string
  // Append the Sortify link to a 'playlist' or 'custom' description.
  appendLink?: boolean
}

/** Collapse line breaks and runs of whitespace into single spaces, and trim. */
export function cleanDescription(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Resolve the description to send for one playlist.
 *
 * Pure: reads only its inputs. The result is cleaned and fits MAX_DESCRIPTION_LENGTH.
 * When the link is appended, the user's text is cut first so the link always survives.
 */
export function resolveDescription(
  playlist: Pick<Playlist, 'description'>,
  options: DescriptionOptions,
): string {
  if (options.mode === 'site') return DEFAULT_DESCRIPTION

  const source = options.mode === 'custom' ? options.customText : playlist.description
  const text = cleanDescription(source ?? '')
  if (!text) return DEFAULT_DESCRIPTION

  if (!options.appendLink) return text.slice(0, MAX_DESCRIPTION_LENGTH)

  const suffix = ` · ${SORTIFY_SITE_URL}`
  const room = MAX_DESCRIPTION_LENGTH - suffix.length
  return text.slice(0, room).trimEnd() + suffix
}
