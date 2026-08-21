import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LeaveWorkspaceModal from '@/components/workspace/LeaveWorkspaceModal.vue'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mountModal(props: Partial<{
  lossMessages: string[]
  qualityMessages: string[]
  canSave: boolean
}> = {}) {
  return mount(LeaveWorkspaceModal, {
    props: { lossMessages: ['You have unsaved changes.'], ...props },
  })
}

function buttonLabels(wrapper: ReturnType<typeof mountModal>): string[] {
  return wrapper.findAll('.leave-modal__footer button').map((b) => b.text())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LeaveWorkspaceModal', () => {
  it('renders one line per loss message', () => {
    const wrapper = mountModal({
      lossMessages: ['You have unsaved changes.', '"Orphan" is in no playlist.'],
    })
    expect(wrapper.findAll('.leave-modal__line').map((n) => n.text())).toEqual([
      'You have unsaved changes.',
      '"Orphan" is in no playlist.',
    ])
  })

  it('sets quality messages apart as a footnote', () => {
    const wrapper = mountModal({ qualityMessages: ['"Morning Mix" has no tracks.'] })
    expect(wrapper.find('.leave-modal__footnote').text()).toBe('"Morning Mix" has no tracks.')
  })

  it('omits the footnote entirely when there is nothing advisory', () => {
    expect(mountModal().find('.leave-modal__footnote').exists()).toBe(false)
  })

  // Saving resolves unsaved changes and nothing else, so the action is withheld when there
  // is nothing it could rescue.
  it('offers Save & leave only when saving would do something', () => {
    expect(buttonLabels(mountModal({ canSave: true }))).toEqual(['Stay', 'Leave', 'Save & leave'])
    expect(buttonLabels(mountModal({ canSave: false }))).toEqual(['Stay', 'Leave'])
  })

  it('resolves with save', async () => {
    const wrapper = mountModal({ canSave: true })
    await wrapper.findAll('.leave-modal__footer button')[2]!.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['save']])
  })

  it('resolves with leave', async () => {
    const wrapper = mountModal({ canSave: true })
    await wrapper.findAll('.leave-modal__footer button')[1]!.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['leave']])
  })

  it('cancels from Stay without resolving a choice', async () => {
    const wrapper = mountModal({ canSave: true })
    await wrapper.findAll('.leave-modal__footer button')[0]!.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
