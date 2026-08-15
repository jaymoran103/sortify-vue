import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultControlBar from '@/components/similarity/ResultControlBar.vue'
import type { DoublesControls, OverlapControls, ResultMeasure } from '@/similarity/types'

const CONTROLS: OverlapControls = {
  axis: 'playlist',
  measure: 'jaccard',
  threshold: 0.4,
  sortKey: 'shared',
  sortDir: 'desc',
}

const MEASURES: ResultMeasure[] = [
  { key: 'shared', label: 'Shared', value: 2, display: '2' },
  { key: 'jaccard', label: 'Overlap', value: 0.5, display: '50%' },
]

const DOUBLES_CONTROLS: DoublesControls = {
  reviewFilter: 'unconfirmed',
  minTier: 'low',
  sortKey: 'variants',
  sortDir: 'desc',
}

function factory(
  controls = CONTROLS,
  measures = MEASURES,
  overrides: Partial<{
    mode: 'overlap' | 'doubles'
    equivalenceEnabled: boolean
    hasConfirmedDoubles: boolean
    doublesControls: DoublesControls
  }> = {},
) {
  return mount(ResultControlBar, {
    props: {
      controls,
      measures,
      doublesControls: DOUBLES_CONTROLS,
      mode: 'overlap',
      equivalenceEnabled: true,
      hasConfirmedDoubles: false,
      ...overrides,
    },
  })
}

describe('ResultControlBar', () => {
  it('shows the threshold as a percentage', () => {
    expect(factory().text()).toContain('40%')
  })

  it('emits a threshold patch when the slider moves', async () => {
    const wrapper = factory()
    await wrapper.find('.result-control-bar__threshold').setValue('70')
    expect(wrapper.emitted('update')?.[0]?.[0]).toEqual({ threshold: 0.7 })
  })

  it('offers only the measures the current rows carry as sort options', () => {
    const wrapper = factory()
    const options = wrapper.findComponent({ name: 'SelectDropdown' }).props('options') as {
      key: string
    }[]
    expect(options.map((o) => o.key)).toEqual(['shared', 'jaccard'])
  })

  it('emits an axis patch when the axis toggle is used', async () => {
    const wrapper = factory()
    await wrapper.find('.result-control-bar__axis-track').trigger('click')
    expect(wrapper.emitted('update')?.[0]?.[0]).toEqual({ axis: 'track' })
  })

  it('marks the active axis', () => {
    const wrapper = factory()
    expect(wrapper.find('.result-control-bar__axis-playlist').classes()).toContain(
      'result-control-bar__axis-btn--active',
    )
  })

  it('hides the sort dropdown when there are no measures to sort by', () => {
    const wrapper = factory(CONTROLS, [])
    expect(wrapper.findComponent({ name: 'SelectDropdown' }).exists()).toBe(false)
  })
})

describe('ResultControlBar in doubles mode', () => {
  it('swaps the threshold slider for a review filter', () => {
    const wrapper = factory(CONTROLS, MEASURES, { mode: 'doubles' })
    expect(wrapper.find('.result-control-bar__threshold').exists()).toBe(false)
    expect(wrapper.find('.result-control-bar__review-filter').exists()).toBe(true)
  })

  it('hides the axis toggle, which overlap alone has', () => {
    const wrapper = factory(CONTROLS, MEASURES, { mode: 'doubles' })
    expect(wrapper.find('.result-control-bar__axis').exists()).toBe(false)
  })

  it('emits a doubles patch when the review filter changes', async () => {
    const wrapper = factory(CONTROLS, MEASURES, { mode: 'doubles' })
    await wrapper
      .findComponent({ name: 'SelectDropdown' })
      .vm.$emit('update:modelValue', 'confirmed')
    expect(wrapper.emitted('updateDoubles')?.[0]?.[0]).toEqual({ reviewFilter: 'confirmed' })
  })
})

describe('ResultControlBar equivalence toggle', () => {
  it('stays hidden until a group is confirmed, since it would change nothing', () => {
    expect(factory().find('.result-control-bar__equivalence').exists()).toBe(false)
  })

  it('appears once doubles are confirmed', () => {
    const wrapper = factory(CONTROLS, MEASURES, { hasConfirmedDoubles: true })
    expect(wrapper.find('.result-control-bar__equivalence').exists()).toBe(true)
  })

  it('reflects the current state', () => {
    const wrapper = factory(CONTROLS, MEASURES, {
      hasConfirmedDoubles: true,
      equivalenceEnabled: false,
    })
    const input = wrapper.find('.result-control-bar__equivalence-input')
      .element as HTMLInputElement
    expect(input.checked).toBe(false)
  })

  it('emits the new state when toggled', async () => {
    const wrapper = factory(CONTROLS, MEASURES, { hasConfirmedDoubles: true })
    await wrapper.find('.result-control-bar__equivalence-input').setValue(false)
    expect(wrapper.emitted('updateEquivalence')?.[0]?.[0]).toBe(false)
  })

  it('does not offer the toggle in doubles mode, where it means nothing', () => {
    const wrapper = factory(CONTROLS, MEASURES, { mode: 'doubles', hasConfirmedDoubles: true })
    expect(wrapper.find('.result-control-bar__equivalence').exists()).toBe(false)
  })
})
