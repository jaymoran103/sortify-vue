import { describe, it, expect } from 'vitest'
import { collectWorkspaceIssues, formatNameList } from '@/utils/workspaceIssues'
import type { Track, WorkspacePlaylist, PlaylistId } from '@/types/models'
import type { WorkspaceSnapshot } from '@/types/ui'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlaylist(id: PlaylistId, name: string, trackIDs: string[]): WorkspacePlaylist {
  return { id, name, trackIDs, trackIdSet: new Set(trackIDs), origin: 'library' }
}

function makeTrack(trackID: string, title: string): Track {
  return { trackID, title, artist: 'Artist', album: 'Album', source: 'csv' }
}

function makeSnapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    playlists: [],
    modifiedIds: new Set<PlaylistId>(),
    stableOrder: [],
    tracks: new Map<string, Track>(),
    ...overrides,
  }
}

function codes(snapshot: WorkspaceSnapshot): string[] {
  return collectWorkspaceIssues(snapshot).map((issue) => issue.code)
}

function messageFor(snapshot: WorkspaceSnapshot, code: string): string | undefined {
  return collectWorkspaceIssues(snapshot).find((issue) => issue.code === code)?.message
}

// ─── formatNameList ──────────────────────────────────────────────────────────

describe('formatNameList', () => {
  it('returns an empty string for no names', () => {
    expect(formatNameList([])).toBe('')
  })

  it('quotes a single name', () => {
    expect(formatNameList(['Alpha'])).toBe('"Alpha"')
  })

  it('joins two names with and', () => {
    expect(formatNameList(['Alpha', 'Beta'])).toBe('"Alpha" and "Beta"')
  })

  it('joins names up to the cap with commas and a final and', () => {
    expect(formatNameList(['Alpha', 'Beta', 'Gamma'])).toBe('"Alpha", "Beta" and "Gamma"')
  })

  it('summarises the remainder past the cap', () => {
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']
    expect(formatNameList(names)).toBe('"Alpha", "Beta", "Gamma" and 2 more')
  })

  it('honours a custom cap', () => {
    expect(formatNameList(['Alpha', 'Beta', 'Gamma'], 1)).toBe('"Alpha" and 2 more')
  })
})

// ─── collectWorkspaceIssues ──────────────────────────────────────────────────

describe('collectWorkspaceIssues', () => {
  it('reports nothing for a clean workspace', () => {
    const snapshot = makeSnapshot({
      playlists: [makePlaylist(1, 'PL', ['t1'])],
      stableOrder: ['t1'],
      tracks: new Map([['t1', makeTrack('t1', 'Song A')]]),
    })
    expect(collectWorkspaceIssues(snapshot)).toEqual([])
  })

  it('reports unsaved changes as a loss', () => {
    const issues = collectWorkspaceIssues(makeSnapshot({ modifiedIds: new Set([1]) }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      code: 'unsaved-changes',
      severity: 'loss',
      message: 'You have unsaved changes.',
    })
  })

  // ─── Unassigned tracks ─────────────────────────────────────────────────────

  it('names a single unassigned track', () => {
    const snapshot = makeSnapshot({
      stableOrder: ['t1'],
      tracks: new Map([['t1', makeTrack('t1', 'Nightdrive')]]),
    })
    expect(messageFor(snapshot, 'unassigned-tracks')).toBe(
      '"Nightdrive" is in no playlist and will be discarded.',
    )
  })

  it('names and summarises many unassigned tracks', () => {
    const ids = ['t1', 't2', 't3', 't4']
    const snapshot = makeSnapshot({
      stableOrder: ids,
      tracks: new Map(ids.map((id, i) => [id, makeTrack(id, `Song ${i + 1}`)])),
    })
    expect(messageFor(snapshot, 'unassigned-tracks')).toBe(
      '"Song 1", "Song 2", "Song 3" and 1 more are in no playlist and will be discarded.',
    )
  })

  it('reports unassigned tracks as a loss and carries their ids', () => {
    const snapshot = makeSnapshot({
      stableOrder: ['t1'],
      tracks: new Map([['t1', makeTrack('t1', 'Nightdrive')]]),
    })
    const issue = collectWorkspaceIssues(snapshot)[0]!
    expect(issue.severity).toBe('loss')
    expect(issue.ids).toEqual(['t1'])
  })

  it('ignores tracks that belong to a playlist', () => {
    const snapshot = makeSnapshot({
      playlists: [makePlaylist(1, 'PL', ['t1'])],
      stableOrder: ['t1', 't2'],
      tracks: new Map([
        ['t1', makeTrack('t1', 'Member')],
        ['t2', makeTrack('t2', 'Orphan')],
      ]),
    })
    expect(messageFor(snapshot, 'unassigned-tracks')).toContain('"Orphan"')
    expect(messageFor(snapshot, 'unassigned-tracks')).not.toContain('"Member"')
  })

  // A missing record would otherwise drop the track from the list while still counting it.
  it('falls back to the track id when no record is present', () => {
    const snapshot = makeSnapshot({ stableOrder: ['t-ghost'] })
    expect(messageFor(snapshot, 'unassigned-tracks')).toContain('"t-ghost"')
  })

  // ─── Empty playlists ───────────────────────────────────────────────────────

  it('reports an empty playlist as quality, not loss', () => {
    const snapshot = makeSnapshot({ playlists: [makePlaylist(1, 'Morning Mix', [])] })
    expect(collectWorkspaceIssues(snapshot)[0]).toMatchObject({
      code: 'empty-playlist',
      severity: 'quality',
      message: '"Morning Mix" has no tracks.',
    })
  })

  it('pluralises and summarises several empty playlists', () => {
    const snapshot = makeSnapshot({
      playlists: [
        makePlaylist(1, 'A', []),
        makePlaylist(2, 'B', []),
        makePlaylist(3, 'C', []),
        makePlaylist(4, 'D', []),
      ],
    })
    expect(messageFor(snapshot, 'empty-playlist')).toBe('"A", "B", "C" and 1 more have no tracks.')
  })

  // Deliberate change from the old guard, which stayed quiet about playlists the session
  // never touched. As an advisory it no longer blocks, and staying quiet would disagree
  // with the always-on column header marker.
  it('reports an empty playlist the session never modified', () => {
    const snapshot = makeSnapshot({
      playlists: [makePlaylist(1, 'Untouched', [])],
      modifiedIds: new Set<PlaylistId>(),
    })
    expect(codes(snapshot)).toEqual(['empty-playlist'])
  })

  // ─── Ordering ──────────────────────────────────────────────────────────────

  it('orders loss issues ahead of quality issues', () => {
    const snapshot = makeSnapshot({
      playlists: [makePlaylist(1, 'Empty', [])],
      modifiedIds: new Set([1]),
      stableOrder: ['t1'],
      tracks: new Map([['t1', makeTrack('t1', 'Orphan')]]),
    })
    expect(codes(snapshot)).toEqual(['unsaved-changes', 'unassigned-tracks', 'empty-playlist'])
  })
})
