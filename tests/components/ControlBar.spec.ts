import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ControlBar from '@/components/common/ControlBar.vue'

describe('ControlBar', () => {
  it('renders default slot content', () => {
    const wrapper = mount(ControlBar, {
      slots: { default: '<input class="search-input" placeholder="Search" />' },
    })
    expect(wrapper.find('.control-bar__controls .search-input').exists()).toBe(true)
  })

  it('renders actions slot when provided', () => {
    const wrapper = mount(ControlBar, {
      slots: {
        default: '<span>controls</span>',
        actions: '<button class="action-btn">Add</button>',
      },
    })
    expect(wrapper.find('.control-bar__actions .action-btn').exists()).toBe(true)
  })

  it('does not render actions wrapper when actions slot is empty', () => {
    const wrapper = mount(ControlBar, {
      slots: { default: '<span>controls</span>' },
    })
    expect(wrapper.find('.control-bar__actions').exists()).toBe(false)
  })
})
