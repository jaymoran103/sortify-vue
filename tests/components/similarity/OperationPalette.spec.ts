import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OperationPalette from '@/components/similarity/OperationPalette.vue'
import { OVERLAP_PRESETS } from '@/similarity/presets'

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
