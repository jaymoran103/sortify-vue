import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResultVerbStrip from '@/components/similarity/ResultVerbStrip.vue'
import type { ResultRow } from '@/similarity/types'

function row(subject: 'playlist' | 'track'): ResultRow {
  return {
    key: 'k',
    subject,
    primaryLabel: 'label',
    measures: [],
    denominator: '1 of 1',
    memberIds: ['1', '2'],
  }
}

describe('ResultVerbStrip', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('disables every verb with nothing selected', () => {
    const wrapper = mount(ResultVerbStrip, { props: { selectedRows: [] } })
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })

  it('reports the selection count', () => {
    const wrapper = mount(ResultVerbStrip, { props: { selectedRows: [row('playlist')] } })
    expect(wrapper.text()).toContain('1 selected')
  })

  it('emits openInWorkspace', async () => {
    const wrapper = mount(ResultVerbStrip, { props: { selectedRows: [row('playlist')] } })
    await wrapper.find('.result-verb-strip__open').trigger('click')
    expect(wrapper.emitted('openInWorkspace')).toHaveLength(1)
  })

  it('emits saveAsSession', async () => {
    const wrapper = mount(ResultVerbStrip, { props: { selectedRows: [row('playlist')] } })
    await wrapper.find('.result-verb-strip__save').trigger('click')
    expect(wrapper.emitted('saveAsSession')).toHaveLength(1)
  })

  it('emits analyze', async () => {
    const wrapper = mount(ResultVerbStrip, { props: { selectedRows: [row('track')] } })
    await wrapper.find('.result-verb-strip__analyze').trigger('click')
    expect(wrapper.emitted('analyze')).toHaveLength(1)
  })

  it('labels the workspace verb for track rows', () => {
    const wrapper = mount(ResultVerbStrip, { props: { selectedRows: [row('track')] } })
    expect(wrapper.find('.result-verb-strip__open').text()).toContain('playlists')
  })
})
