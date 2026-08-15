import { describe, it, expect } from 'vitest'
import { OVERLAP_PRESETS, DEFAULT_PRESET_KEY, getPreset, findPresets } from '@/similarity/presets'

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
