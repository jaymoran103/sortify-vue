import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHistoryStore } from '@/stores/history'

function bundleFile(name: string, exportedAt: string, ids: string[]): File {
  const data = {
    exportedAt,
    tracks: ids.map((id) => ({ trackID: id, title: id, artist: 'a', album: 'b', source: 'spotify' })),
    playlists: [{ name: 'P', trackIDs: ids }],
  }
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

describe('history store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds every valid file and sorts snapshots oldest first', async () => {
    const store = useHistoryStore()
    await store.importFiles([
      bundleFile('late.json', '2026-09-01T00:00:00Z', ['a', 'b', 'c']),
      bundleFile('early.json', '2026-08-01T00:00:00Z', ['a', 'b']),
    ])
    expect(store.snapshots.map((s) => s.fileName)).toEqual(['early.json', 'late.json'])
    expect(store.latest?.fileName).toBe('late.json')
  })

  it('reports a bad file without blocking the rest', async () => {
    const store = useHistoryStore()
    const report = await store.importFiles([
      new File(['{oops'], 'broken.json'),
      new File([JSON.stringify({ tracks: [] })], 'partial.json'),
      bundleFile('good.json', '2026-08-01T00:00:00Z', ['a']),
    ])
    expect(report.map((r) => r.status)).toEqual(['error', 'error', 'added'])
    expect(report[0]!.message).toMatch(/Not valid JSON/)
    expect(report[1]!.message).toMatch(/playlists/)
    expect(store.snapshots).toHaveLength(1)
  })

  it('skips a snapshot already loaded, in this batch or an earlier one', async () => {
    const store = useHistoryStore()
    await store.importFiles([bundleFile('one.json', '2026-08-01T00:00:00Z', ['a'])])
    const report = await store.importFiles([
      bundleFile('copy.json', '2026-08-01T00:00:00Z', ['a']),
      bundleFile('new.json', '2026-08-02T00:00:00Z', ['a', 'b']),
      bundleFile('new-again.json', '2026-08-02T00:00:00Z', ['a', 'b']),
    ])
    expect(report.map((r) => r.status)).toEqual(['duplicate', 'added', 'duplicate'])
    expect(store.snapshots).toHaveLength(2)
  })

  it('diffs each snapshot against the one before it', async () => {
    const store = useHistoryStore()
    await store.importFiles([
      bundleFile('1.json', '2026-08-01T00:00:00Z', ['a', 'b']),
      bundleFile('2.json', '2026-08-02T00:00:00Z', ['b', 'c', 'd']),
    ])
    expect(store.diffs[0]).toBeNull()
    expect(store.diffs[1]).toMatchObject({ tracksAdded: 2, tracksRemoved: 1 })
  })

  it('removes one snapshot, and clears all', async () => {
    const store = useHistoryStore()
    await store.importFiles([
      bundleFile('1.json', '2026-08-01T00:00:00Z', ['a']),
      bundleFile('2.json', '2026-08-02T00:00:00Z', ['b']),
    ])
    store.removeSnapshot(store.snapshots[0]!.id)
    expect(store.snapshots.map((s) => s.fileName)).toEqual(['2.json'])
    store.clear()
    expect(store.snapshots).toEqual([])
    expect(store.lastReport).toEqual([])
  })

  it('returns an empty report for no files', async () => {
    const store = useHistoryStore()
    expect(await store.importFiles([])).toEqual([])
    expect(store.importing).toBe(false)
  })
})
