import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultTable from '@/components/similarity/ResultTable.vue'
import type { ResultRow } from '@/similarity/types'

const ROWS: ResultRow[] = [
  {
    key: '1:2',
    subject: 'playlist',
    primaryLabel: 'Alpha <-> Beta',
    secondaryLabel: 'Beta is 100% inside Alpha',
    sizeTitle: 'Alpha: 44 unique of 46 entries',
    measures: [
      { key: 'shared', label: 'Shared', value: 2, display: '2', bar: 1 },
      { key: 'jaccard', label: 'Overlap', value: 0.5, display: '50%' },
    ],
    denominator: '2 of 4',
    memberIds: ['1', '2'],
  },
]

// ScrollableList virtualises against a real layout, which jsdom does not provide, so it renders
// zero rows unstubbed. tests/components/dashboard/LibraryCard.spec.ts stubs it the same way.
const ScrollableListStub = {
  props: ['items'],
  template: `
    <div>
      <template v-for="(item, index) in items" :key="index">
        <slot name="item" :item="item" :index="index" />
      </template>
      <slot v-if="items.length === 0" name="empty" />
    </div>
  `,
}

function factory(rows: ResultRow[] = ROWS, selectedKeys = new Set<string>()) {
  return mount(ResultTable, {
    props: { rows, selectedKeys, emptyMessage: 'Nothing here.' },
    global: { stubs: { ScrollableList: ScrollableListStub } },
  })
}

describe('ResultTable', () => {
  it('renders one header cell per measure', () => {
    const wrapper = factory()
    const headers = wrapper.findAll('.result-table__head .result-table__cell--measure')
    expect(headers.map((h) => h.text())).toEqual(['Shared', 'Overlap'])
  })

  it('renders each measure display value', () => {
    const wrapper = factory()
    expect(wrapper.text()).toContain('50%')
    expect(wrapper.text()).toContain('2 of 4')
  })

  it('renders a bar only for measures that carry one', () => {
    const wrapper = factory()
    expect(wrapper.findAll('.result-table__bar')).toHaveLength(1)
  })

  it('exposes the dedupe disclosure as a title attribute', () => {
    const wrapper = factory()
    expect(wrapper.find('.result-table__label').attributes('title')).toBe(
      'Alpha: 44 unique of 46 entries',
    )
  })

  it('marks selected rows', () => {
    const wrapper = factory(ROWS, new Set(['1:2']))
    expect(wrapper.find('.result-table__row--selected').exists()).toBe(true)
  })

  it('emits rowClick with the row key', async () => {
    const wrapper = factory()
    await wrapper.findAll('.result-table__row')[1]!.trigger('click')
    expect(wrapper.emitted('rowClick')?.[0]?.[0]).toBe('1:2')
  })

  it('shows the caller-supplied empty message when there are no rows', () => {
    const wrapper = factory([])
    expect(wrapper.text()).toContain('Nothing here.')
  })

  it('adapts its columns to a different measure set', () => {
    const trackRow: ResultRow = {
      key: 'a:b',
      subject: 'track',
      primaryLabel: 'Anytime + Feeling That Way',
      measures: [
        { key: 'together', label: 'Together', value: 3, display: '3', bar: 1 },
        { key: 'ratio', label: 'Always', value: 1, display: '100%' },
      ],
      denominator: '3 of 3',
      memberIds: ['a', 'b'],
    }
    const wrapper = factory([trackRow])
    const headers = wrapper.findAll('.result-table__head .result-table__cell--measure')
    expect(headers.map((h) => h.text())).toEqual(['Together', 'Always'])
  })
})
