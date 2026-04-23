/**
 * useLiveQuery Unit Tests
 *
 * These tests mock Dexie's `liveQuery` so the subscriber can be called
 * synchronously and deterministically without real IndexedDB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, createApp, watch } from 'vue'

// ─── Controlled Observable state, hoisted so it's available inside vi.mock ──

const { subRef, mockUnsubscribe, mockLiveQuery } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn()
  const subRef = {
    current: null as {
      next: (v: unknown) => void
      error: (e: unknown) => void
    } | null,
  }
  const mockLiveQuery = vi.fn(() => ({
    subscribe(sub: typeof subRef.current) {
      subRef.current = sub
      return { unsubscribe: mockUnsubscribe }
    },
  }))
  return { subRef, mockUnsubscribe, mockLiveQuery }
})

vi.mock('dexie', () => ({ liveQuery: mockLiveQuery }))

import { useLiveQuery } from '@/composables/useLiveQuery'

// ─── withSetup helper ─────────────────────────────────────────────────────────
// Runs a composable inside a real mounted Vue app so lifecycle hooks fire.
// Returns [result, unmount].

function withSetup<T>(composable: () => T): [T, () => void] {
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => null
    },
  })
  app.mount(document.createElement('div'))
  return [result, () => app.unmount()]
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useLiveQuery', () => {
  beforeEach(() => {
    subRef.current = null
    mockUnsubscribe.mockReset()
    mockLiveQuery.mockClear()
  })

  // ── Initialisation ────────────────────────────────────────────────────────

  it('returns a ref initialized to the provided initial value', () => {
    const result = useLiveQuery(() => Promise.resolve([1, 2, 3]), [1, 2])
    expect(result.value).toEqual([1, 2])
  })

  it('returns a ref initialized to undefined when no initial value is given', () => {
    const result = useLiveQuery(() => Promise.resolve(42))
    expect(result.value).toBeUndefined()
  })

  it('calls liveQuery with the provided query function', () => {
    const query = () => Promise.resolve([])
    useLiveQuery(query, [])
    expect(mockLiveQuery).toHaveBeenCalledWith(query)
  })

  // ── Reactive updates ──────────────────────────────────────────────────────

  it('updates the ref when the subscriber fires next', async () => {
    const result = useLiveQuery<string[]>(() => Promise.resolve([]), [])
    expect(result.value).toEqual([])

    subRef.current!.next(['alpha', 'beta'])
    await nextTick()

    expect(result.value).toEqual(['alpha', 'beta'])
  })

  it('triggers dependent computeds when next fires', async () => {
    const result = useLiveQuery<number[]>(() => Promise.resolve([]), [])

    // Compute something dependent on result
    let computed_count = 0
    const stop = watch(result, () => {
      computed_count++
    })

    subRef.current!.next([10, 20, 30])
    await nextTick()

    expect(computed_count).toBe(1)
    stop()
  })

  it('updates the ref synchronously (before nextTick)', () => {
    const result = useLiveQuery<string>(() => Promise.resolve(''), 'initial')

    subRef.current!.next('updated')

    // The ref value must be updated immediately (before any tick)
    expect(result.value).toBe('updated')
  })

  it('fires multiple updates in sequence', async () => {
    const result = useLiveQuery<number>(() => Promise.resolve(0), 0)

    subRef.current!.next(1)
    await nextTick()
    subRef.current!.next(2)
    await nextTick()
    subRef.current!.next(3)
    await nextTick()

    expect(result.value).toBe(3)
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('logs an error to console when the subscriber fires error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    useLiveQuery(() => Promise.resolve(null))

    const boom = new Error('IDB failure')
    subRef.current!.error(boom)

    expect(consoleSpy).toHaveBeenCalledWith('liveQuery error:', boom)
    consoleSpy.mockRestore()
  })

  it('does not throw when error fires without any consumers', () => {
    useLiveQuery(() => Promise.resolve(null))
    expect(() => subRef.current!.error(new Error('oops'))).not.toThrow()
  })

  // ── Lifecycle cleanup ─────────────────────────────────────────────────────

  it('calls subscription.unsubscribe() on component unmount', () => {
    const [, unmount] = withSetup(() =>
      useLiveQuery(() => Promise.resolve([]), []),
    )
    expect(mockUnsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does NOT call unsubscribe when called outside component context', () => {
    // Called at module level (e.g. inside a Pinia store setup) — no getCurrentInstance()
    useLiveQuery(() => Promise.resolve([]), [])
    // No unmount possible since there's no component; unsubscribe must never be called
    expect(mockUnsubscribe).not.toHaveBeenCalled()
  })

  it('registers only one cleanup per call (not multiple onBeforeUnmount calls)', () => {
    const [, unmount] = withSetup(() =>
      useLiveQuery(() => Promise.resolve([]), []),
    )
    unmount()
    unmount() // mount/unmount pairs should be idempotent
    // unsubscribe is called exactly once (not twice)
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
