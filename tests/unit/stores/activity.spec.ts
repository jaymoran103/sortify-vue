import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useActivityStore } from '@/stores/activity'

describe('useActivityStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with no operations', () => {
    const store = useActivityStore()
    expect(store.operations.size).toBe(0)
    expect(store.activeOperation).toBeNull()
  })

  it('startOperation creates an active item with null progress', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test operation')
    const op = store.operations.get('op1')
    expect(op).toBeDefined()
    expect(op?.status).toBe('active')
    expect(op?.label).toBe('Test operation')
    expect(op?.progress).toBeNull()
    expect(op?.errors).toEqual([])
  })

  it('activeOperation returns the first active item', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'First')
    expect(store.activeOperation?.id).toBe('op1')
  })

  it('activeOperation returns null when there are no operations', () => {
    const store = useActivityStore()
    expect(store.activeOperation).toBeNull()
  })

  it('updateProgress sets progress on the operation', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.updateProgress('op1', { done: 3, total: 10, phase: 'Importing', itemLabel: 'foo.csv' })
    const op = store.operations.get('op1')
    expect(op?.progress?.done).toBe(3)
    expect(op?.progress?.total).toBe(10)
    expect(op?.progress?.phase).toBe('Importing')
    expect(op?.progress?.itemLabel).toBe('foo.csv')
  })

  it('updateProgress does nothing for unknown id', () => {
    const store = useActivityStore()
    expect(() => store.updateProgress('nope', { done: 1, total: 5 })).not.toThrow()
    expect(store.operations.size).toBe(0)
  })

  it('addError appends to errors list', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.addError('op1', { category: 'network', message: 'timeout', items: ['track-1'] })
    store.addError('op1', { category: 'missing-data', message: 'no title', items: [] })
    const op = store.operations.get('op1')
    expect(op?.errors).toHaveLength(2)
    expect(op?.errors[0]?.category).toBe('network')
    expect(op?.errors[1]?.category).toBe('missing-data')
  })

  it('completeOperation sets status to done and records completedAt', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    const before = Date.now()
    store.completeOperation('op1')
    const op = store.operations.get('op1')
    expect(op?.status).toBe('done')
    expect(op?.completedAt).toBeGreaterThanOrEqual(before)
  })

  it('completeOperation auto-clears after 5s', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1')
    expect(store.operations.has('op1')).toBe(true)
    vi.advanceTimersByTime(5000)
    expect(store.operations.has('op1')).toBe(false)
  })

  it('completeOperation does not clear before 5s', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1')
    vi.advanceTimersByTime(4999)
    expect(store.operations.has('op1')).toBe(true)
  })

  it('failOperation sets status to error and appends error entry', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.failOperation('op1', 'Something went wrong')
    const op = store.operations.get('op1')
    expect(op?.status).toBe('error')
    expect(op?.completedAt).toBeDefined()
    expect(op?.errors.some((e) => e.message === 'Something went wrong')).toBe(true)
  })

  it('failOperation does nothing for unknown id', () => {
    const store = useActivityStore()
    expect(() => store.failOperation('nope', 'err')).not.toThrow()
  })

  it('failOperation uses default category "error" when none is provided', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.failOperation('op1', 'Something went wrong')
    const op = store.operations.get('op1')
    expect(op?.errors[0]?.category).toBe('error')
  })

  it('failOperation uses a custom errorCategory when provided', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.failOperation('op1', 'Spotify rate limit reached.', 'rate-limit')
    const op = store.operations.get('op1')
    expect(op?.status).toBe('error')
    expect(op?.errors[0]?.category).toBe('rate-limit')
    expect(op?.errors[0]?.message).toBe('Spotify rate limit reached.')
  })

  it('clearOperation removes the item', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.clearOperation('op1')
    expect(store.operations.has('op1')).toBe(false)
  })

  it('clearAll removes all items', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'A')
    store.startOperation('op2', 'B')
    store.clearAll()
    expect(store.operations.size).toBe(0)
  })

  it('startOperation replaces an existing operation with the same id', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'First')
    store.startOperation('op1', 'Second')
    expect(store.operations.get('op1')?.label).toBe('Second')
    expect(store.operations.size).toBe(1)
  })

  it('activeOperation returns the completed operation when there is no active operation', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1')
    expect(store.activeOperation?.id).toBe('op1')
    expect(store.activeOperation?.status).toBe('done')
    vi.advanceTimersByTime(5000)
  })

  it('activeOperation returns the most recent error when there is no active operation', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Older')
    store.failOperation('op1', 'first failure')
    vi.advanceTimersByTime(1)
    store.startOperation('op2', 'Newer')
    store.failOperation('op2', 'second failure')

    expect(store.activeOperation?.id).toBe('op2')
    expect(store.activeOperation?.status).toBe('error')
  })

  // ── History ─────────────────────────────────────────────────────────────────

  it('starts with empty history and empty recentOperations', () => {
    const store = useActivityStore()
    expect(store.history).toEqual([])
    expect(store.recentOperations).toEqual([])
  })

  it('startOperation stores source on the item', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test', 'file-import')
    expect(store.operations.get('op1')?.source).toBe('file-import')
  })

  it('startOperation without source leaves source undefined', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    expect(store.operations.get('op1')?.source).toBeUndefined()
  })

  it('completeOperation adds item to history', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1')
    expect(store.history).toHaveLength(1)
    expect(store.history[0]?.id).toBe('op1')
    expect(store.history[0]?.status).toBe('done')
  })

  it('completeOperation stores summary on item in history', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1', { tracks: 42, playlists: 3, warnings: 1 })
    expect(store.history[0]?.summary?.tracks).toBe(42)
    expect(store.history[0]?.summary?.playlists).toBe(3)
    expect(store.history[0]?.summary?.warnings).toBe(1)
  })

  it('completeOperation does not remove item from history after auto-clear', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1')
    vi.advanceTimersByTime(10000)
    expect(store.history).toHaveLength(1)
    expect(store.operations.has('op1')).toBe(false)
  })

  it('failOperation adds item to history with error status', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.failOperation('op1', 'Something broke')
    expect(store.history).toHaveLength(1)
    expect(store.history[0]?.status).toBe('error')
    expect(store.history[0]?.errors[0]?.message).toBe('Something broke')
  })

  it('dismissHistoryItem removes item from history', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1')
    expect(store.history).toHaveLength(1)
    store.dismissHistoryItem('op1')
    expect(store.history).toHaveLength(0)
  })

  it('dismissHistoryItem removes item from operations immediately', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1')
    expect(store.operations.has('op1')).toBe(true)
    store.dismissHistoryItem('op1')
    expect(store.operations.has('op1')).toBe(false)
  })

  it('dismissHistoryItem does nothing for unknown id', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Test')
    store.completeOperation('op1')
    expect(() => store.dismissHistoryItem('does-not-exist')).not.toThrow()
    expect(store.history).toHaveLength(1)
  })

  it('clearHistory removes all items from history', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'A')
    store.completeOperation('op1')
    store.startOperation('op2', 'B')
    store.completeOperation('op2')
    expect(store.history).toHaveLength(2)
    store.clearHistory()
    expect(store.history).toHaveLength(0)
  })

  it('clearHistory does not affect live operations', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Active')
    store.startOperation('op2', 'Done')
    store.completeOperation('op2')
    store.clearHistory()
    expect(store.operations.has('op1')).toBe(true)
  })

  it('recentOperations returns items sorted newest-first', () => {
    const store = useActivityStore()
    store.startOperation('op1', 'Older')
    store.completeOperation('op1')
    vi.advanceTimersByTime(1)
    store.startOperation('op2', 'Newer')
    store.completeOperation('op2')
    const recent = store.recentOperations
    expect(recent[0]?.id).toBe('op2')
    expect(recent[1]?.id).toBe('op1')
  })
})
