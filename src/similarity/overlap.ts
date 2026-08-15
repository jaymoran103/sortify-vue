import type {
  CursorScope,
  InvertedIndex,
  OverlapControls,
  ResultMeasure,
  ResultRow,
  ScanNote,
  ScanResult,
} from './types'

/** Report progress every N tracks rather than every track, to keep postMessage traffic sane. */
const PROGRESS_INTERVAL = 500

/** Formats a 0..1 ratio for display. */
function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

/**
 * Resolves the cursor into the set of playlist IDs a scan may touch.
 *
 * Returns null when the cursor is empty, which means the whole library. A track cursor resolves
 * to the playlists containing at least one of those tracks.
 */
function resolvePlaylistScope(index: InvertedIndex, scope: CursorScope): Set<number> | null {
  if (scope.subject === 'playlist' && scope.ids.length > 0) {
    return new Set(scope.ids.map(Number))
  }
  if (scope.subject === 'track' && scope.ids.length > 0) {
    const owners = new Set<number>()
    for (const trackID of scope.ids) {
      for (const id of index.trackToPlaylists.get(trackID) ?? []) owners.add(id)
    }
    return owners
  }
  return null
}

/**
 * Builds the disclosure string for playlists whose unique track count differs from their raw
 * entry count, so a row never silently disagrees with the counts shown elsewhere in the app.
 * Returns undefined when nothing diverges.
 */
function sizeTitleFor(index: InvertedIndex, ids: number[]): string | undefined {
  const parts: string[] = []
  for (const id of ids) {
    const unique = index.playlistSizes.get(id) ?? 0
    const raw = index.rawSizes.get(id) ?? 0
    if (raw !== unique) {
      parts.push(`${index.playlistNames.get(id)}: ${unique} unique of ${raw} entries`)
    }
  }
  return parts.length > 0 ? parts.join('; ') : undefined
}

/**
 * Sorts rows by the measure the controls name.
 *
 * An unknown sortKey falls back to the row's first measure, matching how useListSort already
 * handles an unknown key. Nothing is sortable that is not also visible as a column.
 */
function applySort(rows: ResultRow[], controls: OverlapControls): ResultRow[] {
  const fallback = rows[0]?.measures[0]?.key
  const key = rows[0]?.measures.some((m) => m.key === controls.sortKey)
    ? controls.sortKey
    : fallback
  if (!key) return rows

  const direction = controls.sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a.measures.find((m) => m.key === key)?.value ?? 0
    const bv = b.measures.find((m) => m.key === key)?.value ?? 0
    return (av - bv) * direction
  })
}

/**
 * Normalises one measure's bar widths against the largest value in the result set.
 * Mutates the measures in place, so it must run after every row is built.
 */
function normaliseBars(rows: ResultRow[], barKey: string): void {
  let max = 0
  for (const row of rows) {
    const value = row.measures.find((m) => m.key === barKey)?.value ?? 0
    if (value > max) max = value
  }
  if (max === 0) return
  for (const row of rows) {
    const found = row.measures.find((m) => m.key === barKey)
    if (found) found.bar = found.value / max
  }
}

/**
 * Scans for playlists that share tracks.
 *
 * Inputs: a built index, live control values, and the cursor's scope.
 * Output: one row per surviving playlist pair, carrying shared count, Jaccard and containment.
 * Side effects: none beyond the optional progress callback.
 *
 * Pairs are accumulated through the inverted index rather than by iterating all pairs, so two
 * playlists that share nothing are never visited. Containment ships on every row because full
 * containment means "delete the smaller" while a 0.7 Jaccard means "merge", and one number
 * cannot say which.
 */
export function scanPlaylistOverlap(
  index: InvertedIndex,
  controls: OverlapControls,
  scope: CursorScope,
  onProgress?: (done: number, total: number) => void,
): ScanResult {
  const scopeSet = resolvePlaylistScope(index, scope)
  const referenceId =
    scope.subject === 'playlist' && scope.ids.length === 1 ? Number(scope.ids[0]) : null

  const shared = new Map<string, number>()
  const total = index.trackToPlaylists.size
  let done = 0

  for (const owners of index.trackToPlaylists.values()) {
    done += 1
    if (onProgress && (done % PROGRESS_INTERVAL === 0 || done === total)) onProgress(done, total)
    if (owners.length < 2) continue

    for (let i = 0; i < owners.length; i += 1) {
      for (let j = i + 1; j < owners.length; j += 1) {
        // Owner arrays follow playlist insertion order, which is not guaranteed ascending,
        // so normalise each pair key rather than assuming owners[i] < owners[j].
        const a = Math.min(owners[i]!, owners[j]!)
        const b = Math.max(owners[i]!, owners[j]!)
        if (scopeSet && !scopeSet.has(a) && !scopeSet.has(b)) continue
        const key = `${a}:${b}`
        shared.set(key, (shared.get(key) ?? 0) + 1)
      }
    }
  }

  const notes: ScanNote[] = [
    {
      kind: 'pre-threshold-count',
      message: `${shared.size} playlist pairs overlap at all.`,
      count: shared.size,
    },
  ]

  const rows: ResultRow[] = []
  for (const [key, count] of shared) {
    const [rawA, rawB] = key.split(':')
    const a = Number(rawA)
    const b = Number(rawB)
    const sizeA = index.playlistSizes.get(a) ?? 0
    const sizeB = index.playlistSizes.get(b) ?? 0
    const nameA = index.playlistNames.get(a) ?? String(a)
    const nameB = index.playlistNames.get(b) ?? String(b)

    const union = sizeA + sizeB - count
    const jaccard = union === 0 ? 0 : count / union
    const smallerSize = Math.min(sizeA, sizeB)
    const containment = smallerSize === 0 ? 0 : count / smallerSize
    const smallerName = sizeA <= sizeB ? nameA : nameB
    const largerName = sizeA <= sizeB ? nameB : nameA

    const gate = controls.measure === 'containment' ? containment : jaccard
    if (gate < controls.threshold) continue

    const measures: ResultMeasure[] = []
    if (referenceId !== null) {
      // Reference mode compares everything against one playlist, so only the other side's size
      // is worth a column.
      const otherId = a === referenceId ? b : a
      const otherSize = index.playlistSizes.get(otherId) ?? 0
      measures.push({ key: 'size', label: 'Size', value: otherSize, display: `${otherSize}` })
    } else {
      measures.push({ key: 'sizeA', label: 'Size A', value: sizeA, display: `${sizeA}` })
      measures.push({ key: 'sizeB', label: 'Size B', value: sizeB, display: `${sizeB}` })
    }
    measures.push({ key: 'shared', label: 'Shared', value: count, display: `${count}` })
    measures.push({ key: 'jaccard', label: 'Overlap', value: jaccard, display: percent(jaccard) })
    measures.push({
      key: 'containment',
      label: 'Contained',
      value: containment,
      display: percent(containment),
    })

    const referenceSize = referenceId !== null ? (index.playlistSizes.get(referenceId) ?? 0) : union

    rows.push({
      key,
      subject: 'playlist',
      primaryLabel:
        referenceId !== null
          ? (index.playlistNames.get(a === referenceId ? b : a) ?? '')
          : `${nameA} <-> ${nameB}`,
      secondaryLabel: `${smallerName} is ${percent(containment)} inside ${largerName}`,
      sizeTitle: sizeTitleFor(index, [a, b]),
      measures,
      denominator: `${count} of ${referenceSize}`,
      memberIds: [String(a), String(b)],
    })
  }

  normaliseBars(rows, 'shared')
  return { rows: applySort(rows, controls), notes }
}
