import {
  ALWAYS_TOGETHER_THRESHOLD,
  DEFAULT_JACCARD_THRESHOLD,
  NEAR_IDENTICAL_THRESHOLD,
} from './constants'
import type { OverlapPreset } from './types'

/**
 * The questions the palette offers, expressed entirely as control values over one computation.
 *
 * Aliases exist so the common word finds the tools without the visible label over-promising:
 * "duplicates" implies exactness that overlap scoring cannot deliver, but it is what a user
 * searches for.
 */
export const OVERLAP_PRESETS: OverlapPreset[] = [
  {
    key: 'overlap-any',
    label: 'Playlists that overlap',
    aliases: ['duplicates', 'dupes', 'copies', 'shared tracks'],
    controls: {
      axis: 'playlist',
      measure: 'jaccard',
      threshold: DEFAULT_JACCARD_THRESHOLD,
      sortKey: 'jaccard',
      sortDir: 'desc',
    },
  },
  {
    key: 'overlap-near-identical',
    label: 'Playlists that are nearly identical',
    aliases: ['duplicates', 'dupes', 'copies', 'same'],
    controls: {
      axis: 'playlist',
      measure: 'jaccard',
      threshold: NEAR_IDENTICAL_THRESHOLD,
      sortKey: 'jaccard',
      sortDir: 'desc',
    },
  },
  {
    key: 'overlap-contained',
    label: 'Playlists fully contained in another',
    aliases: ['duplicates', 'dupes', 'copies', 'subset', 'inside'],
    controls: {
      axis: 'playlist',
      measure: 'containment',
      threshold: 1,
      // Sorted by shared rather than by size: the biggest absorption is the most actionable one,
      // and shared is a visible column where a combined pair size would not be.
      sortKey: 'shared',
      sortDir: 'desc',
    },
  },
  {
    key: 'duos-always-together',
    label: 'Tracks that always travel together',
    aliases: ['duos', 'pairs', 'together'],
    controls: {
      axis: 'track',
      measure: 'ratio',
      threshold: ALWAYS_TOGETHER_THRESHOLD,
      sortKey: 'together',
      sortDir: 'desc',
    },
  },
]

/**
 * The preset that runs on a cold load. Deliberately the least opinionated one, so the page opens
 * with rows rather than an empty state that reads as breakage.
 */
export const DEFAULT_PRESET_KEY = 'overlap-any'

/** Looks up a preset by key. Returns undefined for an unknown key. */
export function getPreset(key: string): OverlapPreset | undefined {
  return OVERLAP_PRESETS.find((preset) => preset.key === key)
}

/**
 * Filters presets by a search query, matching the visible label or any alias.
 * An empty query returns every preset.
 */
export function findPresets(query: string): OverlapPreset[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return OVERLAP_PRESETS
  return OVERLAP_PRESETS.filter(
    (preset) =>
      preset.label.toLowerCase().includes(trimmed) ||
      preset.aliases.some((alias) => alias.includes(trimmed)),
  )
}
