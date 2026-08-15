import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CursorBar from '@/components/similarity/CursorBar.vue'
import type { IndexStatus } from '@/stores/similarity'

interface CursorBarProps {
  scopeLabel: string
  isEmpty: boolean
  indexStatus: IndexStatus
  uniqueTrackCount: number | null
  progress: { done: number; total: number } | null
}

function factory(overrides: Partial<CursorBarProps> = {}) {
  return mount(CursorBar, {
    props: {
      scopeLabel: 'Whole library',
      isEmpty: true,
      indexStatus: 'ready',
      uniqueTrackCount: 1200,
      progress: null,
      ...overrides,
    },
  })
}

describe('CursorBar', () => {
  it('shows the scope label', () => {
    expect(factory().text()).toContain('Whole library')
  })

  it('hides the clear button when the cursor is empty', () => {
    expect(factory().find('.cursor-bar__clear').exists()).toBe(false)
  })

  it('emits clear when the cursor holds something', async () => {
    const wrapper = factory({ isEmpty: false, scopeLabel: '3 playlists' })
    await wrapper.find('.cursor-bar__clear').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('reports a ready index with its track count', () => {
    expect(factory().text()).toContain('1200')
  })

  it('offers a rebuild action only when the index is stale', async () => {
    expect(factory().find('.cursor-bar__rebuild').exists()).toBe(false)
    const stale = factory({ indexStatus: 'stale' })
    expect(stale.text().toLowerCase()).toContain('stale')
    await stale.find('.cursor-bar__rebuild').trigger('click')
    expect(stale.emitted('rebuild')).toHaveLength(1)
  })

  it('renders a progress bar while the index is building', () => {
    const wrapper = factory({ indexStatus: 'building', progress: { done: 2, total: 8 } })
    expect(wrapper.findComponent({ name: 'ProgressBar' }).exists()).toBe(true)
  })
})
