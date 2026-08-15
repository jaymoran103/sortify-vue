import { computed } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db'
import { useLiveQuery } from '@/composables/useLiveQuery'
import type { EquivalenceGroup, MatchTier } from '@/types/models'

/**
 * Equivalence Store: persistence and review lifecycle for doubles groups.
 *
 * Groups are shown as "doubles" in the UI; the stored concept is equivalence between distinct
 * track IDs. Confirming a group is what applies it -- Overlap resolves through confirmedMap at
 * read time, so nothing on disk is rewritten. Consolidate is the one exception, and it is a
 * separate explicit action.
 */
export const useEquivalenceStore = defineStore('equivalence', () => {
  const groups = useLiveQuery(() => db.equivalenceGroups.toArray(), [])

  /** Every group, or an empty array before the first liveQuery emission. */
  const all = computed<EquivalenceGroup[]>(() => groups.value ?? [])

  const unconfirmedCount = computed(
    () => all.value.filter((group) => group.status === 'unconfirmed').length,
  )

  const confirmedGroups = computed(() =>
    all.value.filter((group) => group.status === 'confirmed'),
  )

  /**
   * Maps every track in a confirmed group to that group's canonical track ID.
   *
   * The canonical ID is the preferred variant when the user has chosen one, otherwise the first
   * track in the group. Overlap folds variants together through this map, which is what makes two
   * playlists holding different releases of one recording count as sharing it.
   */
  const canonicalMap = computed(() => {
    const map = new Map<string, string>()
    for (const group of confirmedGroups.value) {
      const canonical = group.preferredTrackId ?? group.trackIds[0]
      if (!canonical) continue
      for (const trackId of group.trackIds) map.set(trackId, canonical)
    }
    return map
  })

  /** Every group as the scan needs it, so a rescan can skip decided tracks. */
  const knownGroups = computed(() =>
    all.value.map((group) => ({ trackIds: group.trackIds, status: group.status })),
  )

  /** Looks up the stored group containing a track, or undefined. */
  function groupForTrack(trackId: string): EquivalenceGroup | undefined {
    return all.value.find((group) => group.trackIds.includes(trackId))
  }

  /**
   * Persists newly detected groups as unconfirmed.
   * Written in one transaction so liveQuery fires once rather than once per group.
   */
  async function saveDetected(
    detected: { trackIds: string[]; matchTier: MatchTier }[],
  ): Promise<void> {
    if (detected.length === 0) return
    const now = Date.now()
    await db.transaction('rw', db.equivalenceGroups, async () => {
      for (const group of detected) {
        await db.equivalenceGroups.add({
          trackIds: group.trackIds,
          matchTier: group.matchTier,
          status: 'unconfirmed',
          detectedAt: now,
        })
      }
    })
  }

  /** Marks a group confirmed, optionally setting the variant to keep. */
  async function confirm(id: number, preferredTrackId?: string): Promise<void> {
    await db.equivalenceGroups.update(id, {
      status: 'confirmed',
      reviewedAt: Date.now(),
      ...(preferredTrackId ? { preferredTrackId } : {}),
    })
  }

  /** Marks a group rejected. A rescan will not propose it again. */
  async function reject(id: number): Promise<void> {
    await db.equivalenceGroups.update(id, { status: 'rejected', reviewedAt: Date.now() })
  }

  /** Sets which variant to keep without changing the review status. */
  async function setPreferred(id: number, preferredTrackId: string): Promise<void> {
    await db.equivalenceGroups.update(id, { preferredTrackId })
  }

  /** Returns a group to unconfirmed, which also un-applies it from Overlap's scoring. */
  async function resetGroup(id: number): Promise<void> {
    await db.equivalenceGroups.update(id, { status: 'unconfirmed', reviewedAt: undefined })
  }

  /** Confirms every group currently unconfirmed, in one transaction. */
  async function confirmAll(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    const now = Date.now()
    await db.transaction('rw', db.equivalenceGroups, async () => {
      for (const id of ids) {
        await db.equivalenceGroups.update(id, { status: 'confirmed', reviewedAt: now })
      }
    })
  }

  /** Removes every stored group. Used by a full re-scan that starts from nothing. */
  async function clearAll(): Promise<void> {
    await db.equivalenceGroups.clear()
  }

  return {
    groups,
    all,
    unconfirmedCount,
    confirmedGroups,
    canonicalMap,
    knownGroups,
    groupForTrack,
    saveDetected,
    confirm,
    reject,
    setPreferred,
    resetGroup,
    confirmAll,
    clearAll,
  }
})
