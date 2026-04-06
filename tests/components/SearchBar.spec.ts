import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchBar from '@/components/common/SearchBar.vue'

describe('SearchBar', () => {
  it('renders input with default placeholder', () => {
    const wrapper = mount(SearchBar, { props: { modelValue: '' } })
    expect(wrapper.find('input').attributes('placeholder')).toBe('Search...')
  })

  it('renders input with custom placeholder', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', placeholder: 'Filter...' },
    })
    expect(wrapper.find('input').attributes('placeholder')).toBe('Filter...')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(SearchBar, { props: { modelValue: '' } })
    const input = wrapper.find('input')
    await input.setValue('hello')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['hello'])
  })

  it('shows clear button when value is non-empty', () => {
    const wrapper = mount(SearchBar, { props: { modelValue: 'abc' } })
    expect(wrapper.find('.search-bar__clear').exists()).toBe(true)
  })

  it('hides clear button when value is empty', () => {
    const wrapper = mount(SearchBar, { props: { modelValue: '' } })
    expect(wrapper.find('.search-bar__clear').exists()).toBe(false)
  })

  it('clear button emits empty string', async () => {
    const wrapper = mount(SearchBar, { props: { modelValue: 'abc' } })
    await wrapper.find('.search-bar__clear').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([''])
  })
})
