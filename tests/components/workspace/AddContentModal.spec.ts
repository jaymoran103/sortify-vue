import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AddContentModal from '@/components/workspace/AddContentModal.vue'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mountModal() {
  return mount(AddContentModal)
}

function cardLabels(wrapper: ReturnType<typeof mountModal>): string[] {
  return wrapper.findAll('.source-card__label').map((n) => n.text())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AddContentModal', () => {
  it('offers the three add sources as cards', () => {
    expect(mountModal().findAll('.source-card')).toHaveLength(3)
  })

  // The two playlist cards must stay adjacent so they read as a pair — separating them with
  // the track option makes the pair harder to compare.
  it('keeps the playlist cards adjacent, with tracks and creation at opposite ends', () => {
    expect(cardLabels(mountModal())).toEqual(['Add Tracks', 'Add Playlist', 'New Playlist'])
  })

  it('resolves with the chosen source rather than acting on it', async () => {
    const wrapper = mountModal()
    await wrapper.findAll('.source-card')[1]!.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['playlist']])
  })

  it('resolves with tracks from the first card', async () => {
    const wrapper = mountModal()
    await wrapper.findAll('.source-card')[0]!.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['tracks']])
  })

  it('resolves with new from the last card', async () => {
    const wrapper = mountModal()
    await wrapper.findAll('.source-card')[2]!.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['new']])
  })

  it('emits cancel from the footer without choosing a source', async () => {
    const wrapper = mountModal()
    await wrapper.find('.io-modal__footer button').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('uses the shared I/O modal shell', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.io-modal').exists()).toBe(true)
    expect(wrapper.find('.source-card-grid').exists()).toBe(true)
  })
})
