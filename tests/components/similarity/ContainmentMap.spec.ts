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

/** Same chain as YEAR, but August is most of the year, so its rim is wide enough to label. */
const WIDE_CHAIN: ContainmentCluster = {
  key: 'cluster-wide',
  roots: [node(1, "'18_", 100, [node(3, 'August_2018', 90, [node(4, 'High_Shit', 3)])])],
  playlistCount: 3,
  depth: 3,
  multiParentCount: 0,
  coveredTracks: 90,
  totalTracks: 100,
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

describe('ContainmentMap labels', () => {
  /** Reads a circle and its label straight out of the rendered SVG. */
  function readNode(wrapper: ReturnType<typeof factory>, name: string) {
    const group = wrapper
      .findAll('.containment-map__node')
      .find((g) => g.find('title').text().startsWith(`${name} `))!
    const circle = group.find('circle')
    const label = group.find('.containment-map__label')
    return {
      cy: Number(circle.attributes('cy')),
      r: Number(circle.attributes('r')),
      labelY: label.exists() ? Number(label.attributes('y')) : null,
      text: label.exists() ? label.text() : '',
    }
  }

  it('puts a container label on its rim, clear of its children', () => {
    const year = readNode(factory(), "'18_")
    // Near the top edge, not the middle, which belongs to the nested circles.
    expect(year.labelY!).toBeLessThan(year.cy - year.r * 0.7)
    expect(year.labelY!).toBeGreaterThan(year.cy - year.r)
  })

  it('puts a mid-chain container label on its own rim too', () => {
    // A container's rim ring, not its middle, which belongs to whatever nests inside it. Sized so
    // the ring is wide enough to hold text: the suppression rule below covers the narrow case.
    const august = readNode(factory([WIDE_CHAIN], WIDE_CHAIN.key), 'August_2018')
    expect(august.labelY!).toBeLessThan(august.cy - august.r * 0.7)
  })

  it('drops a label the circle is too small to hold, rather than letting it spill out', () => {
    // August is a container here too, but a twentieth of the year, so its rim ring is only a few
    // pixels of chord. No text fits legibly, so none is drawn and the hover title carries the name.
    const august = readNode(factory(), 'August_2018')
    expect(august.labelY).toBeNull()
    expect(
      factory()
        .findAll('.containment-map__circle title')
        .map((n) => n.text()),
    ).toContain('August_2018 — 20 tracks')
  })

  it('keeps a leaf label in its middle', () => {
    const january = readNode(factory(), 'January_2018')
    expect(Math.abs(january.labelY! - january.cy)).toBeLessThan(8)
  })

  it('shows the track count on a container label, so size never has to be trusted', () => {
    expect(readNode(factory(), "'18_").text).toContain('392')
  })

  it('shows the track count under a leaf name when there is room', () => {
    const counts = factory()
      .findAll('.containment-map__count')
      .map((n) => n.text())
    expect(counts).toContain('31')
  })
})

describe('ContainmentMap scale key', () => {
  it('draws reference circles rather than describing size in words', () => {
    expect(factory().findAll('.containment-map__key-circle').length).toBeGreaterThan(0)
  })

  it('names the unit on its largest reference', () => {
    expect(factory().find('.containment-map__key').text()).toContain('tracks')
  })

  it('draws the key at exactly the scale the map used, so the two can be compared', () => {
    const wrapper = factory()
    // The key SVG shares the map's user-unit width, so one viewBox unit is one pixel in both.
    expect(wrapper.find('.containment-map__key').attributes('viewBox')).toMatch(/^0 0 480 /)

    const key = wrapper.find('.containment-map__key-circle')
    const value = Number(wrapper.find('.containment-map__key-label').text().replace(/\D/g, ''))
    const keyR = Number(key.attributes('r'))

    // A 392-track root against the key's own value: radii must be in sqrt proportion.
    const root = wrapper
      .findAll('.containment-map__node')
      .find((g) => g.find('title').text().startsWith("'18_ "))!
    const rootR = Number(root.find('circle').attributes('r'))
    expect(rootR / keyR).toBeCloseTo(Math.sqrt(392 / value), 4)
  })

  it('shows no key when there is nothing drawn', () => {
    expect(factory([]).find('.containment-map__key').exists()).toBe(false)
  })
})

describe('ContainmentMap legend', () => {
  it('explains what nesting means', () => {
    expect(factory().find('.containment-map__legend').text()).toContain(
      'every track is in the outer playlist',
    )
  })

  it('explains the dashed stroke', () => {
    expect(factory().find('.containment-map__legend').text()).toContain('also inside another')
  })

  it('claims one scale across the map, now that there is one', () => {
    const note = factory().find('.containment-map__scale-note').text()
    expect(note).toContain('one scale across the whole map')
  })

  it('shows no legend when there is nothing drawn', () => {
    expect(factory([]).find('.containment-map__legend').exists()).toBe(false)
  })
})

describe('ContainmentMap true size', () => {
  // Twelve months covering nearly all of the year: the year cannot hold them and still be drawn
  // at its own area, so it is widened, and the widening is shown rather than hidden.
  const DENSE: ContainmentCluster = {
    key: 'cluster-dense',
    roots: [
      node(
        1,
        'Year',
        370,
        Array.from({ length: 12 }, (_, i) => node(10 + i, `Month_${i}`, 30)),
      ),
    ],
    playlistCount: 13,
    depth: 2,
    multiParentCount: 0,
    coveredTracks: 360,
    totalTracks: 370,
  }

  it('marks a widened container with its true edge', () => {
    const wrapper = factory([DENSE], DENSE.key)
    const rings = wrapper.findAll('.containment-map__true')
    expect(rings).toHaveLength(1)

    const year = wrapper
      .findAll('.containment-map__node')
      .find((g) => g.find('title').text().startsWith('Year '))!
    expect(Number(rings[0]!.attributes('r'))).toBeLessThan(
      Number(year.find('circle').attributes('r')),
    )
  })

  it('explains the true edge in the legend, but only when one is drawn', () => {
    expect(factory([DENSE], DENSE.key).find('.containment-map__legend').text()).toContain(
      "this container's own track count",
    )
    expect(factory().find('.containment-map__legend').text()).not.toContain('dotted')
  })

  it('draws nothing extra when every container fits its contents', () => {
    expect(factory().findAll('.containment-map__true')).toHaveLength(0)
  })
})
