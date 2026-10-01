import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LibraryHistoryView from '@/components/history/LibraryHistoryView.vue'
import { useHistoryStore } from '@/stores/history'

function bundleFile(name: string, exportedAt: string, ids: string[]): File {
  const data = {
    exportedAt,
    tracks: ids.map((id) => ({ trackID: id, title: id, artist: id, album: 'b', source: 'spotify' })),
    playlists: [{ name: 'P', trackIDs: ids }, { name: 'Q', trackIDs: ids.slice(0, 1) }],
  }
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

function mountView() {
  return mount(LibraryHistoryView, { global: { mocks: { $router: { push: () => {} } } } })
}

describe('LibraryHistoryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the empty state before any import', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('No snapshots yet')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('renders tiles, charts and one table row per snapshot after import', async () => {
    const wrapper = mountView()
    await useHistoryStore().importFiles([
      bundleFile('1.json', '2026-08-01T00:00:00Z', ['a', 'b']),
      bundleFile('2.json', '2026-09-01T00:00:00Z', ['a', 'b', 'c']),
    ])
    await flushPromises()
    expect(wrapper.text()).toContain('+1 since previous')
    expect(wrapper.findAll('svg[role="img"]')).toHaveLength(3)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Last import: 2 added')
  })

  it('imports files dropped on the zone', async () => {
    const wrapper = mountView()
    const files = [bundleFile('1.json', '2026-08-01T00:00:00Z', ['a'])]
    await wrapper.find('[data-testid="drop-zone"]').trigger('drop', { dataTransfer: { files } })
    await flushPromises()
    expect(useHistoryStore().snapshots).toHaveLength(1)
  })

  it('lists failed files by name in the import report', async () => {
    const wrapper = mountView()
    await useHistoryStore().importFiles([new File(['nope'], 'bad.json')])
    await flushPromises()
    expect(wrapper.text()).toContain('1 failed')
    expect(wrapper.text()).toContain('bad.json')
  })

  it('drops a snapshot from the Remove button', async () => {
    const wrapper = mountView()
    await useHistoryStore().importFiles([
      bundleFile('1.json', '2026-08-01T00:00:00Z', ['a']),
      bundleFile('2.json', '2026-09-01T00:00:00Z', ['a', 'b']),
    ])
    await flushPromises()
    await wrapper.find('button[aria-label="Remove 2.json"]').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })
})
