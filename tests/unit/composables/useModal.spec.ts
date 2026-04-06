import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useModal } from '@/composables/useModal'
import { useUiStore } from '@/stores/ui'
import { defineComponent } from 'vue'

const StubComponent = defineComponent({ template: '<div />' })

describe('useModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('open delegates to uiStore.openModal', () => {
    const modal = useModal()
    const store = useUiStore()
    expect(store.activeModal).toBeNull()
    modal.open(StubComponent)
    expect(store.activeModal).not.toBeNull()
    store.closeModal()
  })

  it('close delegates to uiStore.closeModal', () => {
    const modal = useModal()
    const store = useUiStore()
    modal.open(StubComponent)
    modal.close()
    expect(store.activeModal).toBeNull()
  })

  it('returns typed result from open', async () => {
    const modal = useModal()
    const promise = modal.open<string>(StubComponent)
    modal.close('done')
    const result = await promise
    expect(result).toBe('done')
  })

  it('passes props to the store config', () => {
    const modal = useModal()
    const store = useUiStore()
    modal.open(StubComponent, { msg: 'hello' })
    expect(store.activeModal?.config.props?.msg).toBe('hello')
    store.closeModal()
  })
})
