import { ref, nextTick } from 'vue'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDebounce } from '@/composables/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const source = ref('hello')
    const debounced = useDebounce(source, 200)
    expect(debounced.value).toBe('hello')
  })

  it('updates after delay elapses', async () => {
    const source = ref('hello')
    const debounced = useDebounce(source, 200)
    source.value = 'world'
    expect(debounced.value).toBe('hello')
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(debounced.value).toBe('world')
  })

  it('resets timer on rapid changes (only last value emits)', async () => {
    const source = ref('a')
    const debounced = useDebounce(source, 200)
    source.value = 'b'
    vi.advanceTimersByTime(100)
    source.value = 'c'
    vi.advanceTimersByTime(100)
    expect(debounced.value).toBe('a')
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(debounced.value).toBe('c')
  })

  it('works with delay of 0', async () => {
    const source = ref(1)
    const debounced = useDebounce(source, 0)
    source.value = 2
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(debounced.value).toBe(2)
  })
})
