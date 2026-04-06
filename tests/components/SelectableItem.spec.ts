import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SelectableItem from '@/components/common/SelectableItem.vue'

describe('SelectableItem', () => {
  it('renders label', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'My Playlist', selected: false },
    })
    expect(wrapper.find('.selectable-item__label').text()).toBe('My Playlist')
  })

  it('renders subtitle when provided', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'My Playlist', subtitle: '12 tracks', selected: false },
    })
    expect(wrapper.find('.selectable-item__subtitle').text()).toBe('12 tracks')
  })

  it('does not render subtitle element when not provided', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'My Playlist', selected: false },
    })
    expect(wrapper.find('.selectable-item__subtitle').exists()).toBe(false)
  })

  it('checkbox reflects selected prop — true', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'A', selected: true },
    })
    const checkbox = wrapper.find<HTMLInputElement>('input[type="checkbox"]').element
    expect(checkbox.checked).toBe(true)
  })

  it('checkbox reflects selected prop — false', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'A', selected: false },
    })
    const checkbox = wrapper.find<HTMLInputElement>('input[type="checkbox"]').element
    expect(checkbox.checked).toBe(false)
  })

  it('clicking the row emits toggle', async () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'A', selected: false },
    })
    await wrapper.find('.selectable-item').trigger('click')
    expect(wrapper.emitted('toggle')).toBeTruthy()
  })

  it('selected row has accent background class', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'A', selected: true },
    })
    expect(wrapper.find('.selectable-item').classes()).toContain('selectable-item--selected')
  })
})
