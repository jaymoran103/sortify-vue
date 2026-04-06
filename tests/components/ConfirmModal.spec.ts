import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'

describe('ConfirmModal', () => {
  it('renders title and message', () => {
    const wrapper = mount(ConfirmModal, {
      props: { title: 'Delete?', message: 'This cannot be undone.' },
    })
    expect(wrapper.text()).toContain('Delete?')
    expect(wrapper.text()).toContain('This cannot be undone.')
  })

  it('confirm button emits confirm event', async () => {
    const wrapper = mount(ConfirmModal, {
      props: { title: 'Are you sure?', message: 'Yes or no?' },
    })
    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find((b) => b.text() === 'Confirm')!
    await confirmBtn.trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')![0]).toEqual([true])
  })

  it('cancel button emits cancel event', async () => {
    const wrapper = mount(ConfirmModal, {
      props: { title: 'Are you sure?', message: 'Yes or no?' },
    })
    const buttons = wrapper.findAll('button')
    const cancelBtn = buttons.find((b) => b.text() === 'Cancel')!
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('danger prop applies danger class to confirm button', () => {
    const wrapper = mount(ConfirmModal, {
      props: { title: 'Delete', message: 'Gone forever.', danger: true },
    })
    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find((b) => b.text() === 'Confirm')!
    expect(confirmBtn.classes()).toContain('btn--danger')
  })

  it('uses custom confirmLabel and cancelLabel', () => {
    const wrapper = mount(ConfirmModal, {
      props: {
        title: 'Remove',
        message: 'Sure?',
        confirmLabel: 'Yes, remove',
        cancelLabel: 'No thanks',
      },
    })
    expect(wrapper.text()).toContain('Yes, remove')
    expect(wrapper.text()).toContain('No thanks')
  })
})
