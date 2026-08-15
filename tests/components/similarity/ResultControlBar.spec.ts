import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultControlBar from '@/components/similarity/ResultControlBar.vue'
import type { OverlapControls, ResultMeasure } from '@/similarity/types'

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

function factory(controls = CONTROLS, measures = MEASURES) {
  return mount(ResultControlBar, { props: { controls, measures } })
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
