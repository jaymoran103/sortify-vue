import { describe, it, expect } from 'vitest'
import {
  planConsolidation,
  describeConsolidation,
  type ConsolidatablePlaylist,
  type ConsolidationGroup,
} from '@/similarity/consolidate'

const GROUPS: ConsolidationGroup[] = [
  { trackIds: ['respect-studio', 'respect-live'], preferredTrackId: 'respect-studio' },
]

function playlist(id: number, trackIDs: string[]): ConsolidatablePlaylist {
  return { id, name: `Playlist ${id}`, trackIDs }
}

describe('planConsolidation', () => {
  it('replaces a non-preferred variant with the preferred one', () => {
    const plan = planConsolidation([playlist(1, ['a', 'respect-live', 'b'])], GROUPS)
    expect(plan.rewrites[0]!.trackIDs).toEqual(['a', 'respect-studio', 'b'])
    expect(plan.totalReplaced).toBe(1)
  })

  it('preserves track order, replacing in place rather than appending', () => {
    const plan = planConsolidation([playlist(1, ['respect-live', 'a', 'b'])], GROUPS)
    expect(plan.rewrites[0]!.trackIDs).toEqual(['respect-studio', 'a', 'b'])
  })

  it('drops a redundant entry when the preferred variant is already present', () => {
    const plan = planConsolidation([playlist(1, ['respect-studio', 'respect-live'])], GROUPS)
    expect(plan.rewrites[0]!.trackIDs).toEqual(['respect-studio'])
    expect(plan.rewrites[0]!.removed).toBe(1)
    expect(plan.rewrites[0]!.replaced).toBe(0)
  })

  it('leaves untouched playlists out of the plan entirely', () => {
    const plan = planConsolidation([playlist(1, ['a', 'b'])], GROUPS)
    expect(plan.rewrites).toEqual([])
    expect(plan.playlistCount).toBe(0)
  })

  it('touches only the playlists it was given, never the whole library', () => {
    const plan = planConsolidation([playlist(1, ['respect-live'])], GROUPS)
    expect(plan.rewrites.map((r) => r.id)).toEqual([1])
  })

  it('returns an empty plan when no group has anything to replace', () => {
    const plan = planConsolidation(
      [playlist(1, ['a'])],
      [{ trackIds: ['a'], preferredTrackId: 'a' }],
    )
    expect(plan.rewrites).toEqual([])
  })

  it('handles several groups across several playlists', () => {
    const groups: ConsolidationGroup[] = [
      { trackIds: ['x1', 'x2'], preferredTrackId: 'x1' },
      { trackIds: ['y1', 'y2'], preferredTrackId: 'y2' },
    ]
    const plan = planConsolidation(
      [playlist(1, ['x2', 'y1']), playlist(2, ['y1', 'z'])],
      groups,
    )
    expect(plan.rewrites).toHaveLength(2)
    expect(plan.rewrites[0]!.trackIDs).toEqual(['x1', 'y2'])
    expect(plan.rewrites[1]!.trackIDs).toEqual(['y2', 'z'])
    expect(plan.totalReplaced).toBe(3)
  })

  it('collapses three variants of one recording down to one entry', () => {
    const groups: ConsolidationGroup[] = [
      { trackIds: ['a1', 'a2', 'a3'], preferredTrackId: 'a1' },
    ]
    const plan = planConsolidation([playlist(1, ['a2', 'a3', 'b'])], groups)
    expect(plan.rewrites[0]!.trackIDs).toEqual(['a1', 'b'])
    expect(plan.rewrites[0]!.replaced).toBe(1)
    expect(plan.rewrites[0]!.removed).toBe(1)
  })
})

describe('describeConsolidation', () => {
  it('names real numbers so the confirmation is informed', () => {
    const plan = planConsolidation([playlist(1, ['respect-live'])], GROUPS)
    const message = describeConsolidation(plan)
    expect(message).toContain('1 track entry')
    expect(message).toContain('1 playlist')
    expect(message).toContain('cannot be undone')
  })

  it('mentions removals as well as replacements', () => {
    const plan = planConsolidation([playlist(1, ['respect-studio', 'respect-live'])], GROUPS)
    expect(describeConsolidation(plan)).toContain('remove 1 now-redundant entry')
  })

  it('pluralises correctly', () => {
    const plan = planConsolidation(
      [playlist(1, ['respect-live']), playlist(2, ['respect-live'])],
      GROUPS,
    )
    const message = describeConsolidation(plan)
    expect(message).toContain('2 track entries')
    expect(message).toContain('2 playlists')
  })

  it('says plainly when there is nothing to do', () => {
    expect(describeConsolidation(planConsolidation([playlist(1, ['a'])], GROUPS))).toBe(
      'Nothing to consolidate in the selected playlists.',
    )
  })
})
