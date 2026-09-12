import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContainmentMap from '@/components/similarity/ContainmentMap.vue'
import type { ContainmentCluster, ContainmentNode } from '@/similarity/containment'

function node(
  playlistId: number,
  name: string,
  size: number,
  children: ContainmentNode[] = [],
  otherContainerCount = 0,
): ContainmentNode {
  return { playlistId, name, size, children, otherContainerCount }
}

const YEAR: ContainmentCluster = {
  key: 'cluster-1',
  roots: [
    node(1, "'18_", 392, [
      node(2, 'January_2018', 31),
      node(3, 'August_2018', 20, [node(4, 'High_Shit', 3)]),
    ]),
  ],
  playlistCount: 4,
  depth: 3,
  multiParentCount: 0,
  coveredTracks: 51,
  totalTracks: 392,
}

const OTHER: ContainmentCluster = {
  key: 'cluster-9',
  roots: [node(9, 'Practical_Donkey', 21, [node(10, 'Daimonji', 8)])],
  playlistCount: 2,
  depth: 2,
  multiParentCount: 1,
  coveredTracks: 8,
  totalTracks: 21,
}

function factory(clusters = [YEAR, OTHER], selectedKey = 'cluster-1') {
  return mount(ContainmentMap, { props: { clusters, selectedKey } })
}

describe('ContainmentMap', () => {
  it('says so plainly when nothing is contained', () => {
    const wrapper = factory([])
    expect(wrapper.text()).toContain('No playlist is fully inside another')
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('draws one circle per playlist in the cluster', () => {
    expect(factory().findAll('.containment-map__circle')).toHaveLength(4)
  })

  it('reports coverage as a number rather than asking the eye to judge area', () => {
    expect(factory().text()).toContain('51 of 392 tracks covered')
  })

  it('labels circles large enough to carry one', () => {
    const labels = factory()
      .findAll('.containment-map__label')
      .map((n) => n.text())
    expect(labels.some((l) => l.includes("'18_"))).toBe(true)
  })

  it('gives every circle a hover title with its real track count', () => {
    const titles = factory()
      .findAll('.containment-map__circle title')
      .map((n) => n.text())
    expect(titles).toContain('January_2018 — 31 tracks')
  })

  it('discloses in the title when a playlist sits inside other containers too', () => {
    const shared: ContainmentCluster = {
      ...YEAR,
      roots: [node(1, 'Year', 50, [node(2, 'Shared', 5, [], 2)])],
    }
    const titles = factory([shared], shared.key)
      .findAll('.containment-map__circle title')
      .map((n) => n.text())
    expect(titles).toContain('Shared — 5 tracks (also inside 2 other containers)')
  })

  it('marks a multi-parent circle so the simplification is visible, not just described', () => {
    const shared: ContainmentCluster = {
      ...YEAR,
      roots: [node(1, 'Year', 50, [node(2, 'Shared', 5, [], 2)])],
    }
    expect(factory([shared], shared.key).find('.containment-map__circle--shared').exists()).toBe(
      true,
    )
  })

  it('notes when the tree hides other containers', () => {
    expect(factory([OTHER], 'cluster-9').text()).toContain('also sit inside other containers')
  })

  it('stays silent about simplification when there is none', () => {
    expect(factory([YEAR], 'cluster-1').find('.containment-map__note').exists()).toBe(false)
  })

  it('offers every cluster, naming its lead playlist and depth', () => {
    const options = factory()
      .findComponent({ name: 'SelectDropdown' })
      .props('options') as { key: string; label: string }[]
    expect(options.map((o) => o.key)).toEqual(['cluster-1', 'cluster-9'])
    expect(options[0]!.label).toContain('3 deep')
  })

  it('emits the chosen cluster', async () => {
    const wrapper = factory()
    await wrapper.findComponent({ name: 'SelectDropdown' }).vm.$emit('update:modelValue', 'cluster-9')
    expect(wrapper.emitted('select')?.[0]?.[0]).toBe('cluster-9')
  })

  it('falls back to the first cluster when the selected key is unknown', () => {
    expect(factory([YEAR, OTHER], 'nonsense').text()).toContain('51 of 392')
  })

  it('emits the playlist behind a clicked circle, so it can feed the cursor', async () => {
    const wrapper = factory()
    await wrapper.findAll('.containment-map__node')[0]!.trigger('click')
    expect(wrapper.emitted('selectPlaylist')?.[0]?.[0]).toBe(1)
  })
})
