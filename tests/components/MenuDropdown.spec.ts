import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MenuDropdown from '@/components/common/MenuDropdown.vue'

describe('MenuDropdown', () => {
  it('runs a picked entry and closes the menu', async () => {
    const action = vi.fn()
    const wrapper = mount(MenuDropdown, {
      props: { label: 'Add', entries: [{ label: 'One', action }, { divider: true }] },
      attachTo: document.body,
    })
    const details = wrapper.element as HTMLDetailsElement
    details.open = true
    await wrapper.get('.menu-item').trigger('click')
    expect(action).toHaveBeenCalledOnce()
    expect(details.open).toBe(false)
    expect(wrapper.findAll('hr')).toHaveLength(1)
    wrapper.unmount()
  })

  it('closes on a click outside and on Escape, but not on a click inside', async () => {
    const wrapper = mount(MenuDropdown, {
      props: { label: 'Columns' },
      slots: { default: '<label class="opt"><input type="checkbox" /> A</label>' },
      attachTo: document.body,
    })
    const details = wrapper.element as HTMLDetailsElement
    details.open = true
    const input = wrapper.get('.opt input').element as HTMLInputElement
    input.click()
    expect(details.open).toBe(true)
    document.body.click()
    expect(details.open).toBe(false)
    details.open = true
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(details.open).toBe(false)
    wrapper.unmount()
  })

  it('returns focus to the trigger when it closes from inside', async () => {
    const wrapper = mount(MenuDropdown, {
      props: { label: 'Add', entries: [{ label: 'One', action: vi.fn() }] },
      attachTo: document.body,
    })
    const details = wrapper.element as HTMLDetailsElement
    details.open = true
    const item = wrapper.get('.menu-item').element as HTMLButtonElement
    item.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.activeElement).toBe(wrapper.get('summary').element)
    wrapper.unmount()
  })

  it('closes when focus tabs out of it', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const wrapper = mount(MenuDropdown, {
      props: { label: 'Add', entries: [{ label: 'One', action: vi.fn() }] },
      attachTo: document.body,
    })
    const details = wrapper.element as HTMLDetailsElement
    details.open = true
    await wrapper.get('.menu-item').trigger('focusout', { relatedTarget: outside })
    expect(details.open).toBe(false)
    wrapper.unmount()
    outside.remove()
  })

  it('lines the panel up with the chosen edge', () => {
    const wrapper = mount(MenuDropdown, { props: { label: 'Add', align: 'right' } })
    expect(wrapper.get('.menu-panel').classes()).toContain('menu-dropdown__panel--right')
  })
})
