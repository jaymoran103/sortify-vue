import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NoticedRail from '@/components/similarity/NoticedRail.vue'
import type { RailFinding } from '@/stores/similarity'

const FINDINGS: RailFinding[] = [
  { presetKey: 'overlap-contained', label: 'Playlists fully inside another', count: 2 },
  { presetKey: 'doubles-unreviewed', label: 'Doubled tracks unreviewed', count: 6 },
]

function factory(findings = FINDINGS, isStale = false) {
  return mount(NoticedRail, { props: { findings, isStale } })
}

describe('NoticedRail', () => {
  it('lists each finding with its count', () => {
    const wrapper = factory()
    const items = wrapper.findAll('.noticed-rail__item')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('2')
    expect(items[0]!.text()).toContain('fully inside another')
  })

  it('emits the preset key when a finding is chosen', async () => {
    const wrapper = factory()
    await wrapper.findAll('.noticed-rail__item')[1]!.trigger('click')
    expect(wrapper.emitted('select')?.[0]?.[0]).toBe('doubles-unreviewed')
  })

  it('renders nothing at all when there is nothing to notice', () => {
    expect(factory([]).find('.noticed-rail').exists()).toBe(false)
  })

  it('hides itself when the index is stale rather than asserting stale findings', () => {
    expect(factory(FINDINGS, true).find('.noticed-rail').exists()).toBe(false)
  })

  it('preserves the order it was given, which is the actionability ranking', () => {
    const labels = factory().findAll('.noticed-rail__label').map((n) => n.text())
    expect(labels).toEqual(['Playlists fully inside another', 'Doubled tracks unreviewed'])
  })
})
