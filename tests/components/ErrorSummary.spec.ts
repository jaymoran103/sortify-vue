import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorSummary from '@/components/common/ErrorSummary.vue'
import type { ActivityError } from '@/types/ui'

function makeErrors(category: string, count: number): ActivityError[] {
  return Array.from({ length: count }, (_, i) => ({
    category,
    message: `Issue ${i + 1}`,
    items: [],
  }))
}

describe('ErrorSummary', () => {
  it('renders nothing when errors array is empty', () => {
    const wrapper = mount(ErrorSummary, { props: { errors: [] } })
    expect(wrapper.find('.error-summary').exists()).toBe(false)
  })

  it('renders one group per unique category', () => {
    const errors: ActivityError[] = [
      { category: 'warning', message: 'Skipped track A', items: [] },
      { category: 'warning', message: 'Skipped track B', items: [] },
      { category: 'error', message: 'Network timeout', items: [] },
    ]
    const wrapper = mount(ErrorSummary, { props: { errors } })
    expect(wrapper.findAll('.error-summary__group')).toHaveLength(2)
  })

  it('applies category CSS class to each group', () => {
    const errors: ActivityError[] = [
      { category: 'rate-limit', message: 'Rate limit hit', items: [] },
    ]
    const wrapper = mount(ErrorSummary, { props: { errors } })
    expect(wrapper.find('.error-summary__group--rate-limit').exists()).toBe(true)
  })

  it('shows all items without toggle button when group has 3 or fewer errors', () => {
    const wrapper = mount(ErrorSummary, { props: { errors: makeErrors('warning', 3) } })
    expect(wrapper.findAll('.error-summary__item')).toHaveLength(3)
    expect(wrapper.find('.error-summary__toggle').exists()).toBe(false)
  })

  it('shows only first 3 items and a toggle button when group has more than 3 errors', () => {
    const wrapper = mount(ErrorSummary, { props: { errors: makeErrors('warning', 5) } })
    expect(wrapper.findAll('.error-summary__item')).toHaveLength(3)
    expect(wrapper.find('.error-summary__toggle').exists()).toBe(true)
  })

  it('expands to show all items when toggle button is clicked', async () => {
    const wrapper = mount(ErrorSummary, { props: { errors: makeErrors('warning', 5) } })
    await wrapper.find('.error-summary__toggle').trigger('click')
    expect(wrapper.findAll('.error-summary__item')).toHaveLength(5)
  })

  it('collapses back after a second click on toggle', async () => {
    const wrapper = mount(ErrorSummary, { props: { errors: makeErrors('warning', 5) } })
    const toggle = wrapper.find('.error-summary__toggle')
    await toggle.trigger('click')
    await toggle.trigger('click')
    expect(wrapper.findAll('.error-summary__item')).toHaveLength(3)
  })

  it('renders items sub-list when items array is non-empty', () => {
    const errors: ActivityError[] = [
      { category: 'warning', message: 'Some issue', items: ['track-1', 'track-2'] },
    ]
    const wrapper = mount(ErrorSummary, { props: { errors } })
    expect(wrapper.findAll('.error-summary__sub-item')).toHaveLength(2)
  })

  it('shows category label text in the group header', () => {
    const errors: ActivityError[] = [
      { category: 'rate-limit', message: 'Throttled', items: [] },
    ]
    const wrapper = mount(ErrorSummary, { props: { errors } })
    expect(wrapper.find('.error-summary__category-label').text()).toContain('Rate Limit')
  })
})
