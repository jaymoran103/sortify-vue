import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { usePlaylistStore } from '@/stores/playlists'
import { useTrackStore } from '@/stores/tracks'
import { useCursorStore } from '@/stores/cursor'
import { canonicalMapFrom, useEquivalenceStore } from '@/stores/equivalence'
import { createWorkerClient } from '@/similarity/workerClient'
import { hydrateTrackLabels } from '@/similarity/overlap'
import {
  DEFAULT_PRESET_KEY,
  getDoublesPreset,
  getPreset,
  isDoublesPreset,
} from '@/similarity/presets'
import type {
  DoublesControls,
  IndexInput,
  IndexStats,
  OverlapControls,
  ResultRow,
  ScanNote,
  TrackLabelInput,
  TrackMatchInput,
} from '@/similarity/types'

/** Which operation the active preset selects. */
export type SimilarityMode = 'overlap' | 'doubles'

/** One entry in the Noticed rail: a preset that currently has something to show. */
export interface RailFinding {
  presetKey: string
  label: string
  count: number
}

/** Lifecycle of the inverted index, as surfaced in the cursor bar. */
export type IndexStatus = 'idle' | 'building' | 'ready' | 'stale' | 'error'

/** Used only if the default preset ever goes missing; keeps controls a valid shape regardless. */
const FALLBACK_CONTROLS: OverlapControls = {
  axis: 'playlist',
  measure: 'jaccard',
  threshold: 0.1,
  sortKey: 'jaccard',
  sortDir: 'desc',
}

/**
 * Similarity Store: owns the scan worker, the index lifecycle, live control values and results.
 *
 * The index is never persisted. Rebuilding costs seconds, whereas caching it in Dexie would cost
 * a schema addition plus a stale-cache problem. If it ever earns persistence it folds into the
 * planned "Save Library" bundle rather than standing alone.
 */
export const useSimilarityStore = defineStore('similarity', () => {
  const playlistStore = usePlaylistStore()
  const trackStore = useTrackStore()
  const cursor = useCursorStore()
  const equivalence = useEquivalenceStore()
  const client = createWorkerClient()

  const indexStatus = ref<IndexStatus>('idle')
  const indexStats = ref<IndexStats | null>(null)
  const rows = ref<ResultRow[]>([])
  const notes = ref<ScanNote[]>([])
  const isScanning = ref(false)
  const scanProgress = ref<{ done: number; total: number } | null>(null)
  const error = ref<string | null>(null)

  const activePresetKey = ref(DEFAULT_PRESET_KEY)
  const mode = computed<SimilarityMode>(() =>
    isDoublesPreset(activePresetKey.value) ? 'doubles' : 'overlap',
  )

  const doublesControls = ref<DoublesControls>({
    reviewFilter: 'unconfirmed',
    minTier: 'low',
    sortKey: 'variants',
    sortDir: 'desc',
  })

  /**
   * Whether confirmed doubles are folded together when Overlap counts shared tracks.
   *
   * On by default: confirming a group is the user saying these are the same recording, so the
   * numbers should say so too. The toggle changes what the index contains, not just what a scan
   * reads, so flipping it rebuilds. That costs milliseconds and keeps one source of truth.
   */
  const equivalenceEnabled = ref(true)

  /** The canonical map actually baked into the current index, so a change can invalidate it. */
  const indexedWithEquivalence = ref(false)

  const railFindings = ref<RailFinding[]>([])
  const controls = ref<OverlapControls>({
    ...(getPreset(DEFAULT_PRESET_KEY)?.controls ?? FALLBACK_CONTROLS),
  })

  /**
   * Cheap change signature over the library. Any edit that could alter a scan result changes it.
   *
   * It would miss an edit swapping one track for another without touching lastModified, but every
   * write path in stores/playlists.ts sets lastModified, so that case is currently unreachable.
   */
  const libraryRevision = computed(() => {
    const all = playlistStore.playlists ?? []
    let slots = 0
    let maxModified = 0
    for (const playlist of all) {
      slots += playlist.trackIDs.length
      if ((playlist.lastModified ?? 0) > maxModified) maxModified = playlist.lastModified ?? 0
    }
    return `${all.length}:${slots}:${maxModified}`
  })

  // Marks staleness only. Rebuilding here would hand the user surprise CPU work every time they
  // edited a playlist; run() rebuilds instead, when a result is actually asked for.
  watch(libraryRevision, () => {
    if (indexStatus.value === 'ready') indexStatus.value = 'stale'
  })

  /** Reduces library playlists to the narrow shape the worker needs. */
  function toIndexInput(): IndexInput[] {
    return (playlistStore.playlists ?? [])
      .filter((playlist) => typeof playlist.id === 'number')
      .map((playlist) => ({
        id: playlist.id as number,
        name: playlist.name,
        trackIDs: [...playlist.trackIDs],
      }))
  }

  /** Builds the trackID lookup used to label track rows on the main thread. */
  function trackLabelMap(): Map<string, TrackLabelInput> {
    const map = new Map<string, TrackLabelInput>()
    for (const track of trackStore.tracks ?? []) {
      map.set(track.trackID, { title: track.title, artist: track.artist })
    }
    return map
  }

  /**
   * Builds the index if it is missing or stale. A ready index is left alone.
   *
   * Returns without building when the library is empty. The playlist store hydrates
   * asynchronously through liveQuery and seeds its ref with [], so an empty list at mount is
   * indistinguishable from an empty library. Building anyway would mark a zero-track index
   * "ready" and every later scan would report that nothing overlaps. Staying idle instead lets
   * the caller notice and re-run once the data arrives.
   */
  async function ensureIndex(): Promise<void> {
    const equivalenceMatches = indexedWithEquivalence.value === equivalenceEnabled.value
    if (indexStatus.value === 'building') return
    if (indexStatus.value === 'ready' && equivalenceMatches) return

    const input = toIndexInput()
    if (input.length === 0) {
      indexStatus.value = 'idle'
      return
    }

    indexStatus.value = 'building'
    error.value = null
    try {
      // Read groups from the database rather than the reactive list. On a cold load the
      // equivalence liveQuery may not have emitted yet, and an index built without the fold
      // would silently report that nothing overlaps for a library full of confirmed doubles.
      const canonical = equivalenceEnabled.value
        ? canonicalMapFrom(await equivalence.listAll())
        : undefined
      indexStats.value = await client.build(input, canonical)
      indexedWithEquivalence.value = equivalenceEnabled.value
      indexStatus.value = 'ready'
    } catch (caught) {
      indexStatus.value = 'error'
      error.value = caught instanceof Error ? caught.message : 'Index build failed.'
    }
  }

  /** Reduces library tracks to the fields double matching needs. */
  function toMatchInput(): TrackMatchInput[] {
    return (trackStore.tracks ?? []).map((track) => ({
      trackID: track.trackID,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
    }))
  }

  /** The stored groups, in the shape the worker wants them. */
  function storedGroups() {
    return equivalence.all.map((group) => ({
      id: group.id,
      trackIds: group.trackIds,
      matchTier: group.matchTier,
      status: group.status,
      preferredTrackId: group.preferredTrackId,
    }))
  }

  /**
   * Runs a doubles scan and persists anything newly detected.
   *
   * When detection finds something new it is saved and the scan runs again, because a freshly
   * detected group has no database id yet and a row without one cannot be opened for review. The
   * second pass sees the saved groups, detects nothing further, and returns rows keyed by real
   * ids. It only happens on the first scan after new tracks appear.
   */
  async function runDoubles(): Promise<void> {
    await ensureIndex()
    if (indexStatus.value !== 'ready') return

    isScanning.value = true
    error.value = null
    try {
      const scanned = await client.scanDoubles(
        toMatchInput(),
        equivalence.knownGroups,
        storedGroups(),
        doublesControls.value,
        cursor.scope,
      )
      if (!scanned) return

      if (scanned.groups.length > 0) {
        await equivalence.saveDetected(scanned.groups)

        // Read straight from the database rather than the reactive list: liveQuery fires from an
        // IDB event handler, so the groups just written may not have reached it yet.
        const fresh = await equivalence.listAll()
        const rescanned = await client.scanDoubles(
          toMatchInput(),
          fresh.map((group) => ({ trackIds: group.trackIds, status: group.status })),
          fresh.map((group) => ({
            id: group.id,
            trackIds: group.trackIds,
            matchTier: group.matchTier,
            status: group.status,
            preferredTrackId: group.preferredTrackId,
          })),
          doublesControls.value,
          cursor.scope,
        )
        if (rescanned) {
          rows.value = rescanned.result.rows
          notes.value = rescanned.result.notes
          return
        }
      }

      rows.value = scanned.result.rows
      notes.value = scanned.result.notes
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Doubles scan failed.'
    } finally {
      isScanning.value = false
      scanProgress.value = null
    }
  }

  /**
   * Runs a scan with the current controls and cursor scope.
   * A superseded scan resolves null, in which case the previous rows are left in place.
   */
  async function run(): Promise<void> {
    if (mode.value === 'doubles') {
      await runDoubles()
      return
    }

    await ensureIndex()
    if (indexStatus.value !== 'ready') return

    isScanning.value = true
    error.value = null
    try {
      const result = await client.scan(controls.value, cursor.scope, (done, total) => {
        scanProgress.value = { done, total }
      })
      if (result) {
        rows.value = hydrateTrackLabels(result.rows, trackLabelMap())
        notes.value = result.notes
      }
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Scan failed.'
    } finally {
      isScanning.value = false
      scanProgress.value = null
    }
  }

  /** Replaces the controls wholesale with a preset's values and re-runs. */
  async function applyPreset(key: string): Promise<void> {
    const doubles = getDoublesPreset(key)
    if (doubles) {
      activePresetKey.value = key
      doublesControls.value = { ...doubles.controls }
      await run()
      return
    }

    const preset = getPreset(key)
    if (!preset) return
    activePresetKey.value = key
    controls.value = { ...preset.controls }
    await run()
  }

  /** Merges a doubles control change and re-runs. */
  async function setDoublesControls(patch: Partial<DoublesControls>): Promise<void> {
    doublesControls.value = { ...doublesControls.value, ...patch }
    await run()
  }

  /**
   * Turns the equivalence fold on or off.
   *
   * Marks the index stale rather than rebuilding directly, so the rebuild happens inside run()
   * where progress and errors are already handled.
   */
  async function setEquivalenceEnabled(next: boolean): Promise<void> {
    if (equivalenceEnabled.value === next) return
    equivalenceEnabled.value = next
    if (indexStatus.value === 'ready') indexStatus.value = 'stale'
    await run()
  }

  /**
   * Recomputes the Noticed rail.
   *
   * Ranked by actionability rather than count: two fully-contained playlists are worth more than
   * four hundred weak overlaps, because containment names an unambiguous action. Runs the two
   * cheap overlap presets and reads the doubles count straight from the store.
   */
  async function refreshRail(): Promise<void> {
    await ensureIndex()
    if (indexStatus.value !== 'ready') {
      railFindings.value = []
      return
    }

    const findings: RailFinding[] = []

    const contained = getPreset('overlap-contained')
    if (contained) {
      const result = await client.scan(contained.controls, { subject: null, ids: [] })
      if (result && result.rows.length > 0) {
        findings.push({
          presetKey: contained.key,
          label: 'Playlists fully inside another',
          count: result.rows.length,
        })
      }
    }

    // Counted from a fresh read, for the same reason the index is built from one.
    const unreviewed = (await equivalence.listAll()).filter(
      (group) => group.status === 'unconfirmed',
    ).length
    if (unreviewed > 0) {
      findings.push({
        presetKey: 'doubles-unreviewed',
        label: 'Doubled tracks unreviewed',
        count: unreviewed,
      })
    }

    const identical = getPreset('overlap-near-identical')
    if (identical) {
      const result = await client.scan(identical.controls, { subject: null, ids: [] })
      if (result && result.rows.length > 0) {
        findings.push({
          presetKey: identical.key,
          label: 'Playlists nearly identical',
          count: result.rows.length,
        })
      }
    }

    railFindings.value = findings.slice(0, 4)
  }

  /** Merges a control change and re-runs. The active preset key is unaffected. */
  async function setControls(patch: Partial<OverlapControls>): Promise<void> {
    controls.value = { ...controls.value, ...patch }
    await run()
  }

  /** Tears down the worker. Called when the similarity view unmounts. */
  function dispose(): void {
    client.terminate()
    indexStatus.value = 'idle'
    indexStats.value = null
  }

  return {
    indexStatus,
    indexStats,
    rows,
    notes,
    controls,
    doublesControls,
    equivalenceEnabled,
    mode,
    railFindings,
    activePresetKey,
    isScanning,
    scanProgress,
    error,
    libraryRevision,
    ensureIndex,
    run,
    runDoubles,
    applyPreset,
    setControls,
    setDoublesControls,
    setEquivalenceEnabled,
    refreshRail,
    dispose,
  }
})
