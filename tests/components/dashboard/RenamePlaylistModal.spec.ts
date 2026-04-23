import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RenamePlaylistModal from '@/components/dashboard/RenamePlaylistModal.vue'
import type { Playlist } from '@/types/models'

const playlist: Playlist = { id: 1, name: 'Blues Mix', trackIDs: [] }

function mountModal(overrides: Partial<Playlist> = {}) {
  return mount(RenamePlaylistModal, {
    props: { playlist: { ...playlist, ...overrides } },
  })
}

describe('RenamePlaylistModal', () => {
  it('pre-populates the input with the current playlist name', () => {
    const wrapper = mountModal()
    const input = wrapper.find<HTMLInputElement>('input')
    expect(input.element.value).toBe('Blues Mix')
  })

  it('Rename button is disabled when the input is empty', async () => {
    const wrapper = mountModal()
    await wrapper.find('input').setValue('')
    const btn = wrapper.find<HTMLButtonElement>('button.btn--primary')
    expect(btn.element.disabled).toBe(true)
  })

  it('Rename button is disabled when the input is only whitespace', async () => {
    const wrapper = mountModal()
    await wrapper.find('input').setValue('   ')
    const btn = wrapper.find<HTMLButtonElement>('button.btn--primary')
    expect(btn.element.disabled).toBe(true)
  })

  it('Rename button is enabled when the input has a non-empty value', async () => {
    const wrapper = mountModal()
    await wrapper.find('input').setValue('New Name')
    const btn = wrapper.find<HTMLButtonElement>('button.btn--primary')
    expect(btn.element.disabled).toBe(false)
  })

  it('emits confirm with the trimmed name when Rename is clicked', async () => {
    const wrapper = mountModal()
    await wrapper.find('input').setValue('  New Name  ')
    await wrapper.find('button.btn--primary').trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['New Name']])
  })

  it('emits confirm with trimmed name on Enter key', async () => {
    const wrapper = mountModal()
    await wrapper.find('input').setValue('Jazz Vibes')
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('confirm')).toEqual([['Jazz Vibes']])
  })

  it('does not emit confirm when Enter is pressed with empty input', async () => {
    const wrapper = mountModal()
    await wrapper.find('input').setValue('')
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('confirm')).toBeFalsy()
  })

  it('emits cancel when Cancel button is clicked', async () => {
    const wrapper = mountModal()
    await wrapper.find('button.btn--secondary').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('emits cancel on Escape key', async () => {
    const wrapper = mountModal()
    await wrapper.find('input').trigger('keydown.escape')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
