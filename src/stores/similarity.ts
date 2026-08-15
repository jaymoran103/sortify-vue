import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { usePlaylistStore } from '@/stores/playlists'
import { useTrackStore } from '@/stores/tracks'
import { useCursorStore } from '@/stores/cursor'
import { createWorkerClient } from '@/similarity/workerClient'
import { hydrateTrackLabels } from '@/similarity/overlap'
import { DEFAULT_PRESET_KEY, getPreset } from '@/similarity/presets'
import type {
  IndexInput,
  IndexStats,
  OverlapControls,
  ResultRow,
  ScanNote,
  TrackLabelInput,
} from '@/similarity/types'

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
  const client = createWorkerClient()

  const indexStatus = ref<IndexStatus>('idle')
  const indexStats = ref<IndexStats | null>(null)
  const rows = ref<ResultRow[]>([])
  const notes = ref<ScanNote[]>([])
  const isScanning = ref(false)
  const scanProgress = ref<{ done: number; total: number } | null>(null)
  const error = ref<string | null>(null)

  const activePresetKey = ref(DEFAULT_PRESET_KEY)
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
    if (indexStatus.value === 'ready' || indexStatus.value === 'building') return

    const input = toIndexInput()
    if (input.length === 0) {
      indexStatus.value = 'idle'
      return
    }

    indexStatus.value = 'building'
    error.value = null
    try {
      indexStats.value = await client.build(input)
      indexStatus.value = 'ready'
    } catch (caught) {
      indexStatus.value = 'error'
      error.value = caught instanceof Error ? caught.message : 'Index build failed.'
    }
  }

  /**
   * Runs a scan with the current controls and cursor scope.
   * A superseded scan resolves null, in which case the previous rows are left in place.
   */
  async function run(): Promise<void> {
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
    const preset = getPreset(key)
    if (!preset) return
    activePresetKey.value = key
    controls.value = { ...preset.controls }
    await run()
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
    activePresetKey,
    isScanning,
    scanProgress,
    error,
    libraryRevision,
    ensureIndex,
    run,
    applyPreset,
    setControls,
    dispose,
  }
})
