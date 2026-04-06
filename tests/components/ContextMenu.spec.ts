import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ContextMenu from '@/components/common/ContextMenu.vue'
import { useContextMenu } from '@/composables/useContextMenu'
import type { MenuEntry } from '@/types/ui'

const items: MenuEntry[] = [
  { label: 'Copy', action: () => {} },
  { divider: true },
  { label: 'Paste', action: () => {} },
]

function makeMouseEvent(x = 100, y = 100): MouseEvent {
  return new MouseEvent('contextmenu', { clientX: x, clientY: y, bubbles: true })
}

// Helper to mount ContextMenu with necessary global config
function mountContextMenu() {
  return mount(ContextMenu, {
    attachTo: document.body,
    global: {
      stubs: {
        Teleport: true,
      },
    },
  })
}

describe('ContextMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    useContextMenu().close()
  })

  it('renders nothing when closed', () => {
    const wrapper = mountContextMenu()
    expect(wrapper.find('.context-menu').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders menu items when open', async () => {
    const ctx = useContextMenu()
    ctx.show(makeMouseEvent(), items)
    const wrapper = mountContextMenu()
    await wrapper.vm.$nextTick()
    const menuItems = wrapper.findAll('.context-menu__item')
    expect(menuItems).toHaveLength(2)
    expect(menuItems[0]?.text()).toBe('Copy')
    expect(menuItems[1]?.text()).toBe('Paste')
    wrapper.unmount()
  })

  it('renders dividers', async () => {
    const ctx = useContextMenu()
    ctx.show(makeMouseEvent(), items)
    const wrapper = mountContextMenu()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.context-menu__divider').exists()).toBe(true)
    wrapper.unmount()
  })

  it('clicking item calls action and closes', async () => {
    let called = false
    const ctx = useContextMenu()
    ctx.show(makeMouseEvent(), [{ label: 'Action', action: () => { called = true } }])
    const wrapper = mountContextMenu()
    await wrapper.vm.$nextTick()
    await wrapper.find('.context-menu__item').trigger('click')
    expect(called).toBe(true)
    expect(ctx.isOpen.value).toBe(false)
    wrapper.unmount()
  })

  it('clicking outside closes menu', async () => {
    const ctx = useContextMenu()
    ctx.show(makeMouseEvent(), items)
    const wrapper = mountContextMenu()
    await wrapper.vm.$nextTick()
    expect(ctx.isOpen.value).toBe(true)
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(ctx.isOpen.value).toBe(false)
    wrapper.unmount()
  })
})
