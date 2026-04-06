import { ref, type Ref } from 'vue'

export function useAsyncOp<T>(fn: (...args: unknown[]) => Promise<T>): {
  execute: (...args: unknown[]) => Promise<T | undefined>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  result: Ref<T | null>
  reset: () => void
} {
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const result = ref<T | null>(null) as Ref<T | null>

  async function execute(...args: unknown[]): Promise<T | undefined> {
    if (isLoading.value) return undefined
    isLoading.value = true
    error.value = null
    try {
      const value = await fn(...args)
      result.value = value
      return value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      return undefined
    } finally {
      isLoading.value = false
    }
  }

  function reset(): void {
    isLoading.value = false
    error.value = null
    result.value = null
  }

  return { execute, isLoading, error, result, reset }
}
