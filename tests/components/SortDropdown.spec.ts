import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SortDropdown from '@/components/common/SortDropdown.vue'

const options = [
  { key: 'name-asc', label: 'Name A–Z' },
  { key: 'name-desc', label: 'Name Z–A' },
  { key: 'date', label: 'Date added' },
]

describe('SortDropdown', () => {
  it('renders all options', () => {
    const wrapper = mount(SortDropdown, {
      props: { modelValue: 'name-asc', options },
    })
    const optionEls = wrapper.findAll('option')
    expect(optionEls).toHaveLength(3)
    expect(optionEls[0]?.text()).toBe('Name A–Z')
    expect(optionEls[1]?.text()).toBe('Name Z–A')
    expect(optionEls[2]?.text()).toBe('Date added')
  })

  it('selected value matches modelValue prop', () => {
    const wrapper = mount(SortDropdown, {
      props: { modelValue: 'date', options },
    })
    const select = wrapper.find('select').element as HTMLSelectElement
    expect(select.value).toBe('date')
  })

  it('emits update:modelValue on change', async () => {
    const wrapper = mount(SortDropdown, {
      props: { modelValue: 'name-asc', options },
    })
    await wrapper.find('select').setValue('name-desc')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['name-desc'])
  })
})
