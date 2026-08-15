import { describe, it, expect } from 'vitest'
import {
  OVERLAP_PRESETS,
  DOUBLES_PRESETS,
  DEFAULT_PRESET_KEY,
  getPreset,
  findPresets,
  getDoublesPreset,
  isDoublesPreset,
  findAllPresets,
} from '@/similarity/presets'

describe('presets', () => {
  it('exposes a default preset that exists', () => {
    expect(getPreset(DEFAULT_PRESET_KEY)).toBeDefined()
  })

  it('gives every preset a unique key', () => {
    const keys = OVERLAP_PRESETS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('expresses every preset purely as control values', () => {
    for (const preset of OVERLAP_PRESETS) {
      expect(Object.keys(preset).sort()).toEqual(['aliases', 'controls', 'key', 'label'])
      expect(typeof preset.controls.threshold).toBe('number')
    }
  })

  it('names a sortKey that is a real measure for that axis', () => {
    const playlistMeasures = ['sizeA', 'sizeB', 'size', 'shared', 'jaccard', 'containment']
    const trackMeasures = ['together', 'ratio']
    for (const preset of OVERLAP_PRESETS) {
      const legal = preset.controls.axis === 'playlist' ? playlistMeasures : trackMeasures
      expect(legal).toContain(preset.controls.sortKey)
    }
  })

  it('finds presets by the common word for the concept', () => {
    for (const word of ['duplicates', 'dupes', 'copies']) {
      expect(findPresets(word).length).toBeGreaterThan(0)
    }
  })

  it('matches on the visible label too', () => {
    expect(findPresets('contained').map((p) => p.key)).toContain('overlap-contained')
  })

  it('returns every preset for an empty query', () => {
    expect(findPresets('  ')).toHaveLength(OVERLAP_PRESETS.length)
  })

  it('returns nothing for a query that matches nothing', () => {
    expect(findPresets('zzzz')).toEqual([])
  })
})

describe('doubles presets', () => {
  it('expresses every doubles preset purely as control values', () => {
    for (const preset of DOUBLES_PRESETS) {
      expect(Object.keys(preset).sort()).toEqual(['aliases', 'controls', 'key', 'label'])
    }
  })

  it('gives every preset across both operations a unique key', () => {
    const keys = findAllPresets('').map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('finds doubles presets by the common word for the concept', () => {
    for (const word of ['duplicates', 'dupes', 'versions']) {
      expect(findAllPresets(word).some((p) => isDoublesPreset(p.key))).toBe(true)
    }
  })

  it('distinguishes doubles presets from overlap presets', () => {
    expect(isDoublesPreset('doubles-unreviewed')).toBe(true)
    expect(isDoublesPreset('overlap-any')).toBe(false)
  })

  it('looks up a doubles preset by key', () => {
    expect(getDoublesPreset('doubles-confirmed')?.controls.reviewFilter).toBe('confirmed')
    expect(getDoublesPreset('nope')).toBeUndefined()
  })

  it('searches across both operations at once', () => {
    const all = findAllPresets('')
    expect(all.length).toBe(OVERLAP_PRESETS.length + DOUBLES_PRESETS.length)
  })
})
