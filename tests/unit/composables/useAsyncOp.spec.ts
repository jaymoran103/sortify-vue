import { describe, it, expect, vi } from 'vitest'
import { useAsyncOp } from '@/composables/useAsyncOp'

describe('useAsyncOp', () => {
  it('isLoading is false before execute', () => {
    const { isLoading } = useAsyncOp(async () => 42)
    expect(isLoading.value).toBe(false)
  })

  it('isLoading is true during execute, false after', async () => {
    let resolve!: (v: number) => void
    const fn = () => new Promise<number>((res) => { resolve = res })
    const { execute, isLoading } = useAsyncOp(fn)
    const promise = execute()
    expect(isLoading.value).toBe(true)
    resolve(1)
    await promise
    expect(isLoading.value).toBe(false)
  })

  it('result holds value on success', async () => {
    const { execute, result } = useAsyncOp(async () => 'done')
    await execute()
    expect(result.value).toBe('done')
  })

  it('error holds Error on failure', async () => {
    const { execute, error } = useAsyncOp(async () => { throw new Error('oops') })
    await execute()
    expect(error.value?.message).toBe('oops')
  })

  it('calling execute clears previous error', async () => {
    const failThenSucceed = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok')
    const { execute, error } = useAsyncOp(failThenSucceed)
    await execute()
    expect(error.value).not.toBeNull()
    await execute()
    expect(error.value).toBeNull()
  })

  it('reset clears all state', async () => {
    const { execute, reset, isLoading, error, result } = useAsyncOp(async () => 99)
    await execute()
    reset()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(result.value).toBeNull()
  })

  it('double execute while loading is ignored', async () => {
    let resolve!: (v: string) => void
    const fn = vi.fn(() => new Promise<string>((res) => { resolve = res }))
    const { execute } = useAsyncOp(fn)
    execute()
    execute()
    resolve('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('returns result from execute call', async () => {
    const { execute } = useAsyncOp(async () => 'value')
    const result = await execute()
    expect(result).toBe('value')
  })
})
