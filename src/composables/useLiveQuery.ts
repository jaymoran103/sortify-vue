import { ref, triggerRef, onBeforeUnmount, getCurrentInstance, type Ref } from 'vue'
import { liveQuery } from 'dexie'

/**
 * Composable that integrates Dexie liveQuery with Vue reactivity.
 * The ref starts as undefined, and will be populated when the subscription emits.
 * For array queries, provide an empty array as initial value, for better UX.
 *
 * NOTE: triggerRef() is called explicitly after every write as a defensive measure. This is redundant for normal ref(), but kept since:
 * - Dexie's Observable fires its `next` callback outside Vue's scheduler (an IDB event handler) and may not always flush promptly.
 * - If this composable is ever switched to shallowRef(), triggerRef() becomes required for deep-mutation cases.
 *
 * FUTURE: fix the underlying timing issue, exploring alternatives to triggerRef(): wrapping the liveQuery subscription in a Vue effect, or using a Dexie observable to fire synchronously within the Vue scheduler.
 * for now, triggerRef gets the job done with minimal overhead.
 *
 */
export function useLiveQuery<T>(
  query: () => Promise<T>,
  initialValue?: T,
): Ref<T | undefined> {

  // Create ref with the provided initial value, or undefined if not provided
  const data = ref<T | undefined>(initialValue)

  // Subscribe to the liveQuery and update the ref on new data.
  // triggerRef() forces Vue's dependency graph to mark all watchers of `data` dirty immediately, regardless of where in the event loop this callback fires.
  const subscription = liveQuery(query).subscribe({
    next: (value: T) => {
      data.value = value
      triggerRef(data)
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
