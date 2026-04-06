import { ref, watch, onBeforeUnmount, getCurrentInstance, type Ref } from 'vue'

// Returns a debounced version of the given reactive value that updates after the specified delay
export function useDebounce<T>(value: Ref<T>, delay = 200): Ref<T> {
  const debounced = ref(value.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined

  const cleanup = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  // Schedules an update to the debounced value after the specified delay
  // FUTURE: Review schedlue approach once we have more use cases
  const schedule = (newVal: T) => {
    cleanup()

    // If delay is 0 or negative, update immediately without scheduling
    if (delay <= 0) {
      debounced.value = newVal
      return
    }

    // Actually schedule the update after the delay
    timer = setTimeout(() => {
      debounced.value = newVal
      timer = undefined
    }, delay)
  }

  // Watch the source value and schedule updates to the debounced value
  watch(value, (newVal) => {
    schedule(newVal)
  }, { flush: 'sync' })

  if (getCurrentInstance()) {
    onBeforeUnmount(cleanup)
  }

  return debounced
}
