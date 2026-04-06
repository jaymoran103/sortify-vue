import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusIndicator from '@/components/common/StatusIndicator.vue'

describe('StatusIndicator', () => {
  it('is hidden when not loading and no error', () => {
    const wrapper = mount(StatusIndicator, {
      props: { isLoading: false, error: null },
    })
    expect(wrapper.find('.status-indicator').exists()).toBe(false)
  })

  it('shows spinner when loading', () => {
    const wrapper = mount(StatusIndicator, {
      props: { isLoading: true, error: null },
    })
    expect(wrapper.find('.status-indicator__spinner').exists()).toBe(true)
  })

  it('shows label when loading and label is provided', () => {
    const wrapper = mount(StatusIndicator, {
      props: { isLoading: true, error: null, label: 'Importing...' },
    })
    expect(wrapper.find('.status-indicator__label').text()).toBe('Importing...')
  })

  it('shows progress bar when progress is provided while loading', () => {
    const wrapper = mount(StatusIndicator, {
      props: { isLoading: true, error: null, progress: 0.5 },
    })
    expect(wrapper.findComponent({ name: 'ProgressBar' }).exists()).toBe(true)
  })

  it('does not show progress bar when progress is not provided', () => {
    const wrapper = mount(StatusIndicator, {
      props: { isLoading: true, error: null },
    })
    expect(wrapper.findComponent({ name: 'ProgressBar' }).exists()).toBe(false)
  })

  it('shows error message when error is set', () => {
    const wrapper = mount(StatusIndicator, {
      props: { isLoading: false, error: new Error('Import failed') },
    })
    expect(wrapper.find('.status-indicator__error').text()).toBe('Import failed')
  })

  it('error state takes priority display slot over loading', () => {
    // When both loading false and error set — shows error
    const wrapper = mount(StatusIndicator, {
      props: { isLoading: false, error: new Error('Oops') },
    })
    expect(wrapper.find('.status-indicator__spinner').exists()).toBe(false)
    expect(wrapper.find('.status-indicator__error').exists()).toBe(true)
  })
})
