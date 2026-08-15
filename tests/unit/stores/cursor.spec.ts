import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCursorStore } from '@/stores/cursor'
import type { ResultRow } from '@/similarity/types'

function row(key: string, memberIds: string[]): ResultRow {
  return {
    key,
    subject: 'playlist',
    primaryLabel: key,
    measures: [],
    denominator: '1 of 1',
    memberIds,
  }
}

describe('useCursorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty, which means the whole library', () => {
    const cursor = useCursorStore()
    expect(cursor.isEmpty).toBe(true)
    expect(cursor.scope).toEqual({ subject: null, ids: [] })
  })

  it('holds a subject and ids once set', () => {
    const cursor = useCursorStore()
    cursor.set('playlist', ['1', '2'])
    expect(cursor.isEmpty).toBe(false)
    expect(cursor.count).toBe(2)
    expect(cursor.scope).toEqual({ subject: 'playlist', ids: ['1', '2'] })
  })

  it('reports an empty scope when set with no ids, whatever the subject', () => {
    const cursor = useCursorStore()
    cursor.set('playlist', [])
    expect(cursor.scope.subject).toBeNull()
  })

  it('deduplicates ids', () => {
    const cursor = useCursorStore()
    cursor.set('track', ['a', 'a', 'b'])
    expect(cursor.ids).toEqual(['a', 'b'])
  })

  it('takes the union of member ids from result rows', () => {
    const cursor = useCursorStore()
    cursor.setFromRows([row('1:2', ['1', '2']), row('2:3', ['2', '3'])])
    expect(cursor.subject).toBe('playlist')
    expect([...cursor.ids].sort()).toEqual(['1', '2', '3'])
  })

  it('clears to empty when given no rows', () => {
    const cursor = useCursorStore()
    cursor.set('playlist', ['1'])
    cursor.setFromRows([])
    expect(cursor.isEmpty).toBe(true)
  })

  it('clears back to the whole library', () => {
    const cursor = useCursorStore()
    cursor.set('playlist', ['1'])
    cursor.clear()
    expect(cursor.isEmpty).toBe(true)
    expect(cursor.subject).toBeNull()
  })
})
