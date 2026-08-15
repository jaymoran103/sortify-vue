import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CursorScope, CursorSubject, ResultRow } from '@/similarity/types'

/**
 * Cursor Store: the app-wide selection every operation reads and no operation owns.
 *
 * An empty cursor means the whole library, so every operation is runnable cold with zero input
 * and nothing ever has to prompt the user for a selection first.
 *
 * Deliberately in-memory only. A cursor that outlived a reload would assert a selection over a
 * library that may since have changed.
 */
export const useCursorStore = defineStore('cursor', () => {
  const subject = ref<CursorSubject | null>(null)
  const ids = ref<string[]>([])

  const isEmpty = computed(() => ids.value.length === 0)
  const count = computed(() => ids.value.length)

  /** The scope shape scans consume. Normalises an id-less cursor back to "whole library". */
  const scope = computed<CursorScope>(() => ({
    subject: isEmpty.value ? null : subject.value,
    ids: ids.value,
  }))

  /** Replaces the cursor. Deduplicates ids; an empty id list clears the subject too. */
  function set(nextSubject: CursorSubject, nextIds: string[]): void {
    ids.value = [...new Set(nextIds)]
    subject.value = ids.value.length > 0 ? nextSubject : null
  }

  /**
   * Fills the cursor from result rows, taking the union of their member ids.
   * This is what lets a result feed the next operation. Empty rows clear the cursor.
   */
  function setFromRows(rows: ResultRow[]): void {
    if (rows.length === 0) {
      clear()
      return
    }
    const union = new Set<string>()
    for (const row of rows) {
      for (const id of row.memberIds) union.add(id)
    }
    set(rows[0]!.subject, [...union])
  }

  /** Returns the cursor to empty, which means the whole library. */
  function clear(): void {
    subject.value = null
    ids.value = []
  }

  return { subject, ids, isEmpty, count, scope, set, setFromRows, clear }
})
