import { ref, onBeforeUnmount, getCurrentInstance, type Ref } from 'vue'
import { liveQuery } from 'dexie'

/**
 * Composable that integrates Dexie liveQuery with Vue reactivity.
 * The ref starts as undefined, and will be populated when the subscription emits.
 * For array queries, provide an empty array as initial value, for better UX.
 */
export function useLiveQuery<T>(
  query: () => Promise<T>,
  initialValue?: T,
): Ref<T | undefined> {

  // Create ref with the provided initial value, or undefined if not provided
  const data = ref<T | undefined>(initialValue)

  // Subscribe to the liveQuery and update the ref on new data
  const subscription = liveQuery(query).subscribe({
    next: (value: T) => {
      data.value = value
    },
    error: (err) => {
      console.error('liveQuery error:', err)
    },
  })

  // Only register cleanup if we have a component instance (not in Pinia stores)
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      subscription.unsubscribe()
    })
  }

  // Return the ref, typed so that it can be undefined until the first value is emitted
  return data as Ref<T | undefined>
}
