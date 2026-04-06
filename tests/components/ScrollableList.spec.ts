import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScrollableList from '@/components/common/ScrollableList.vue'

const items = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Gamma' },
]

describe('ScrollableList', () => {
  it('renders nothing in the virtual rows viewport when items is empty', () => {
    const wrapper = mount(ScrollableList, {
      props: { items: [], keyField: 'id', estimateSize: 48 },
    })
    // No virtual rows rendered for empty list
    expect(wrapper.find('[style*="translateY"]').exists()).toBe(false)
  })

  it('renders the #empty slot when items is empty', () => {
    const wrapper = mount(ScrollableList, {
      props: { items: [], keyField: 'id', estimateSize: 48 },
      slots: { empty: '<p class="custom-empty">Nothing here</p>' },
    })
    expect(wrapper.find('.custom-empty').exists()).toBe(true)
    expect(wrapper.find('.custom-empty').text()).toBe('Nothing here')
  })

  it('renders default empty message when no #empty slot and items is empty', () => {
    const wrapper = mount(ScrollableList, {
      props: { items: [], keyField: 'id', estimateSize: 48 },
    })
    expect(wrapper.find('.scrollable-list__empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('No items')
  })

  it('renders the #header slot when provided', () => {
    const wrapper = mount(ScrollableList, {
      props: { items, keyField: 'id', estimateSize: 48 },
      slots: { header: '<div class="my-header">Header</div>' },
    })
    expect(wrapper.find('.my-header').exists()).toBe(true)
  })

  it('does not render header wrapper when #header slot is absent', () => {
    const wrapper = mount(ScrollableList, {
      props: { items, keyField: 'id', estimateSize: 48 },
    })
    expect(wrapper.find('.scrollable-list__header').exists()).toBe(false)
  })

  it('exposes scrollToIndex method', () => {
    const wrapper = mount(ScrollableList, {
      props: { items, keyField: 'id', estimateSize: 48 },
    })
    expect(typeof (wrapper.vm as { scrollToIndex: unknown }).scrollToIndex).toBe('function')
  })
})
