import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OperationPalette from '@/components/similarity/OperationPalette.vue'
import { OVERLAP_PRESETS, DOUBLES_PRESETS } from '@/similarity/presets'

describe('OperationPalette', () => {
  it('lists every preset by label', () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'overlap-any' } })
    for (const preset of OVERLAP_PRESETS) {
      expect(wrapper.text()).toContain(preset.label)
    }
  })

  it('marks the active preset', () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'overlap-contained' } })
    const active = wrapper.find('.operation-palette__item--active')
    expect(active.text()).toContain('fully contained')
  })

  it('emits select with the preset key', async () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'overlap-any' } })
    await wrapper.findAll('.operation-palette__item')[1]!.trigger('click')
    expect(wrapper.emitted('select')?.[0]?.[0]).toBe(OVERLAP_PRESETS[1]!.key)
  })

  it('filters by alias so the common word finds the tools', async () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'overlap-any' } })
    await wrapper.findComponent({ name: 'SearchBar' }).vm.$emit('update:modelValue', 'dupes')
    expect(wrapper.findAll('.operation-palette__item').length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain('always travel together')
  })

  it('shows a message when nothing matches', async () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'overlap-any' } })
    await wrapper.findComponent({ name: 'SearchBar' }).vm.$emit('update:modelValue', 'zzzz')
    expect(wrapper.findAll('.operation-palette__item')).toHaveLength(0)
    expect(wrapper.text()).toContain('No operations match')
  })

  it('renders the reserved rail slot when a parent fills it', () => {
    const wrapper = mount(OperationPalette, {
      props: { activeKey: 'overlap-any' },
      slots: { rail: '<div class="test-rail">rail</div>' },
    })
    expect(wrapper.find('.test-rail').exists()).toBe(true)
  })
})

describe('OperationPalette across both operations', () => {
  it('lists doubles presets alongside overlap ones', () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'overlap-any' } })
    for (const preset of DOUBLES_PRESETS) {
      expect(wrapper.text()).toContain(preset.label)
    }
  })

  it('marks a doubles preset as active when it is selected', () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'doubles-unreviewed' } })
    expect(wrapper.find('.operation-palette__item--active').text()).toContain('not reviewed')
  })

  it('emits a doubles preset key like any other', async () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'overlap-any' } })
    const item = wrapper
      .findAll('.operation-palette__item')
      .find((node) => node.text().includes('not reviewed'))
    await item!.trigger('click')
    expect(wrapper.emitted('select')?.[0]?.[0]).toBe('doubles-unreviewed')
  })

  it('finds presets from both operations with one alias search', async () => {
    const wrapper = mount(OperationPalette, { props: { activeKey: 'overlap-any' } })
    await wrapper.findComponent({ name: 'SearchBar' }).vm.$emit('update:modelValue', 'duplicates')
    const labels = wrapper.findAll('.operation-palette__item').map((n) => n.text())
    expect(labels.some((l) => l.includes('overlap'))).toBe(true)
    expect(labels.some((l) => l.includes('Doubled'))).toBe(true)
  })
})
