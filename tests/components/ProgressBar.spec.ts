import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from '@/components/common/ProgressBar.vue'

describe('ProgressBar', () => {
  it('renders bar at 0% width when progress is 0', () => {
    const wrapper = mount(ProgressBar, { props: { progress: 0 } })
    const fill = wrapper.find('.progress-bar__fill')
    expect(fill.attributes('style')).toContain('width: 0%')
  })

  it('renders bar at 50% width when progress is 0.5', () => {
    const wrapper = mount(ProgressBar, { props: { progress: 0.5 } })
    const fill = wrapper.find('.progress-bar__fill')
    expect(fill.attributes('style')).toContain('width: 50%')
  })

  it('renders bar at 100% when progress is 1', () => {
    const wrapper = mount(ProgressBar, { props: { progress: 1 } })
    const fill = wrapper.find('.progress-bar__fill')
    expect(fill.attributes('style')).toContain('width: 100%')
  })

  it('shows indeterminate class when progress is -1', () => {
    const wrapper = mount(ProgressBar, { props: { progress: -1 } })
    const fill = wrapper.find('.progress-bar__fill')
    expect(fill.classes()).toContain('progress-bar__fill--indeterminate')
  })

  it('renders label when provided', () => {
    const wrapper = mount(ProgressBar, { props: { progress: 0.5, label: 'Loading...' } })
    expect(wrapper.find('.progress-bar__label').text()).toBe('Loading...')
  })

  it('does not render label element when not provided', () => {
    const wrapper = mount(ProgressBar, { props: { progress: 0.5 } })
    expect(wrapper.find('.progress-bar__label').exists()).toBe(false)
  })
})
