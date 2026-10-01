import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { diffSnapshots, parseSnapshot, sortSnapshots } from '@/utils/librarySnapshot'
import type { LibrarySnapshot, SnapshotDiff, SnapshotFileReport } from '@/types/history'

// Library history prototype. Snapshots live in memory only and are gone on reload.
// Persisting them needs a Dexie schema bump, which is an open decision, not this store's call.
export const useHistoryStore = defineStore('history', () => {
  // Oldest first. Replaced, never edited in place.
  const snapshots = shallowRef<LibrarySnapshot[]>([])
  const importing = ref(false)
  const progress = ref({ done: 0, total: 0 })
  const lastReport = shallowRef<SnapshotFileReport[]>([])

  // diffs[i] compares snapshots[i] with snapshots[i - 1]. The first is null.
  const diffs = computed<(SnapshotDiff | null)[]>(() =>
    snapshots.value.map((s, i) => (i === 0 ? null : diffSnapshots(snapshots.value[i - 1]!, s))),
  )

  const latest = computed(() => snapshots.value[snapshots.value.length - 1])

  /**
   * Reads each file as a JSON bundle and adds it as a snapshot.
   * Files are read one at a time so one bad file never blocks the rest.
   * A file whose fingerprint matches a held snapshot, or an earlier file in the batch, is skipped.
   * Side effects: replaces `snapshots` once at the end, sets `lastReport` to one row per file.
   * Returns the report.
   */
  async function importFiles(files: Iterable<File>): Promise<SnapshotFileReport[]> {
    const list = [...files]
    if (list.length === 0) return []
    importing.value = true
    progress.value = { done: 0, total: list.length }

    const held = new Set(snapshots.value.map((s) => s.id))
    const added: LibrarySnapshot[] = []
    const report: SnapshotFileReport[] = []

    try {
      for (const file of list) {
        report.push(await readOne(file, held, added))
        progress.value = { done: progress.value.done + 1, total: list.length }
      }
      if (added.length) snapshots.value = sortSnapshots([...snapshots.value, ...added])
    } finally {
      importing.value = false
      lastReport.value = report
    }
    return report
  }

  async function readOne(file: File, held: Set<string>, added: LibrarySnapshot[]): Promise<SnapshotFileReport> {
    const fileName = file.name
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch (err) {
      return { fileName, status: 'error', message: `Not valid JSON: ${(err as Error).message}`, warnings: [] }
    }
    try {
      const { snapshot, warnings } = parseSnapshot(data, { fileName, lastModified: file.lastModified })
      if (held.has(snapshot.id)) {
        return { fileName, status: 'duplicate', message: 'Same snapshot already loaded.', warnings: [] }
      }
      held.add(snapshot.id)
      added.push(snapshot)
      return { fileName, status: 'added', warnings }
    } catch (err) {
      return { fileName, status: 'error', message: (err as Error).message, warnings: [] }
    }
  }

  /** Drops one snapshot by id. */
  function removeSnapshot(id: string): void {
    snapshots.value = snapshots.value.filter((s) => s.id !== id)
  }

  /** Drops every snapshot and the last import report. */
  function clear(): void {
    snapshots.value = []
    lastReport.value = []
  }

  return { snapshots, importing, progress, lastReport, diffs, latest, importFiles, removeSnapshot, clear }
})
