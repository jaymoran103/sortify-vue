import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui'
import { defineComponent } from 'vue'

const StubComponent = defineComponent({ template: '<div />' })

describe('useUiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('openModal sets activeModal and returns a promise', async () => {
    const store = useUiStore()
    expect(store.activeModal).toBeNull()
    const promise = store.openModal({ component: StubComponent })
    expect(store.activeModal).not.toBeNull()
    expect(promise).toBeInstanceOf(Promise)
    store.closeModal()
    await promise
  })

  it('closeModal resolves the promise with the given result', async () => {
    const store = useUiStore()
    const promise = store.openModal({ component: StubComponent })
    store.closeModal('ok')
    const result = await promise
    expect(result).toBe('ok')
  })

  it('closeModal with no result resolves with null', async () => {
    const store = useUiStore()
    const promise = store.openModal({ component: StubComponent })
    store.closeModal()
    const result = await promise
    expect(result).toBeNull()
  })

  it('opening a second modal closes the first with null', async () => {
    const store = useUiStore()
    const first = store.openModal({ component: StubComponent })
    store.openModal({ component: StubComponent })
    const firstResult = await first
    expect(firstResult).toBeNull()
    store.closeModal()
  })

  it('closeModal sets activeModal to null', () => {
    const store = useUiStore()
    store.openModal({ component: StubComponent })
    store.closeModal()
    expect(store.activeModal).toBeNull()
  })

})
