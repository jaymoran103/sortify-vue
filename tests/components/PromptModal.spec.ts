import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromptModal from '@/components/modals/PromptModal.vue'

function mountModal(props: Record<string, unknown> = {}) {
  return mount(PromptModal, {
    props: { title: 'Test Prompt', ...props },
  })
}

describe('PromptModal', () => {
  it('renders the title', () => {
    const wrapper = mountModal({ title: 'Rename Playlist' })
    expect(wrapper.find('.prompt-modal__title').text()).toBe('Rename Playlist')
  })

  it('renders label when provided', () => {
    const wrapper = mountModal({ label: 'New name' })
    expect(wrapper.find('.prompt-modal__label').text()).toBe('New name')
  })

  it('does not render label element when label is empty', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.prompt-modal__label').exists()).toBe(false)
  })

  it('pre-fills input with initialValue', () => {
    const wrapper = mountModal({ initialValue: 'Old Name' })
    const input = wrapper.find<HTMLInputElement>('input')
    expect(input.element.value).toBe('Old Name')
  })

  it('confirm button is disabled when input is empty', () => {
    const wrapper = mountModal({ initialValue: '' })
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'OK')!
    expect(confirmBtn.attributes('disabled')).toBeDefined()
  })

  it('confirm button is enabled when input has text', async () => {
    const wrapper = mountModal({ initialValue: 'Hello' })
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'OK')!
    expect(confirmBtn.attributes('disabled')).toBeUndefined()
  })

  it('clicking confirm emits confirm with trimmed value', async () => {
    const wrapper = mountModal({ initialValue: '  My Playlist  ' })
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'OK')!
    await confirmBtn.trigger('click')
    expect(wrapper.emitted('confirm')).toBeDefined()
    expect(wrapper.emitted('confirm')![0]).toEqual(['My Playlist'])
  })

  it('clicking cancel emits cancel', async () => {
    const wrapper = mountModal()
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')!
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('cancel')).toBeDefined()
  })

  it('pressing Enter in input emits confirm', async () => {
    const wrapper = mountModal({ initialValue: 'Test Name' })
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('confirm')).toBeDefined()
    expect(wrapper.emitted('confirm')![0]).toEqual(['Test Name'])
  })

  it('pressing Enter with empty input does not emit confirm', async () => {
    const wrapper = mountModal({ initialValue: '' })
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('uses custom confirmLabel and cancelLabel', () => {
    const wrapper = mountModal({ confirmLabel: 'Rename', cancelLabel: 'Discard' })
    const btns = wrapper.findAll('button').map((b) => b.text())
    expect(btns).toContain('Rename')
    expect(btns).toContain('Discard')
  })
})
