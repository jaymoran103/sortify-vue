import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { useUiStore } from '@/stores/ui'

const DummyContent = defineComponent({
  props: { greeting: String },
  emits: ['confirm', 'cancel'],
  template: `<div class="dummy">{{ greeting }}<button @click="$emit('confirm', 'yes')">OK</button></div>`,
})

function mountModal(pinia: ReturnType<typeof createPinia>) {
  return mount(BaseModal, {
    global: {
      plugins: [pinia],
      stubs: {
        Teleport: true,
        Transition: true,
      },
    },
    attachTo: document.body,
  })
}

describe('BaseModal', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders nothing when activeModal is null', () => {
    const wrapper = mountModal(pinia)
    expect(wrapper.find('.modal-backdrop').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders the dynamic component when activeModal is set', async () => {
    const store = useUiStore()
    store.openModal({ component: DummyContent })
    const wrapper = mountModal(pinia)
    await flushPromises()
    expect(wrapper.findComponent(DummyContent).exists()).toBe(true)
    store.closeModal()
    wrapper.unmount()
  })

  it('passes props to the dynamic component', async () => {
    const store = useUiStore()
    store.openModal({ component: DummyContent, props: { greeting: 'Hello!' } })
    const wrapper = mountModal(pinia)
    await flushPromises()
    expect(wrapper.findComponent(DummyContent).text()).toContain('Hello!')
    store.closeModal()
    wrapper.unmount()
  })

  it('closes on backdrop click', async () => {
    const store = useUiStore()
    store.openModal({ component: DummyContent })
    const wrapper = mountModal(pinia)
    await flushPromises()
    await wrapper.vm.$nextTick()
    const backdrop = wrapper.find('.modal-backdrop')
    expect(backdrop.exists()).toBe(true)
    await backdrop.trigger('click')
    expect(store.activeModal).toBeNull()
    wrapper.unmount()
  })

  it('closes on Escape key', async () => {
    const store = useUiStore()
    store.openModal({ component: DummyContent })
    const wrapper = mountModal(pinia)
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(store.activeModal).toBeNull()
    wrapper.unmount()
  })

  it('confirm event from content component closes modal with result', async () => {
    const store = useUiStore()
    const promise = store.openModal({ component: DummyContent })
    const wrapper = mountModal(pinia)
    await flushPromises()
    await wrapper.findComponent(DummyContent).find('button').trigger('click')
    const result = await promise
    expect(result).toBe('yes')
    wrapper.unmount()
  })
})
