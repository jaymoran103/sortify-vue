import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { vi } from 'vitest'
import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryCard from '@/components/dashboard/LibraryCard.vue'
import type { Playlist } from '@/types/models'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

let mockTracks: unknown[] = []
let mockPlaylists: Playlist[] = []

vi.mock('@/stores/tracks', () => ({
  useTrackStore: () => ({ tracks: mockTracks }),
}))

vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({ playlists: mockPlaylists }),
}))

const ScrollableListStub = {
  props: ['items'],
  template: `
    <div>
      <template v-for="(item, index) in items" :key="index">
        <slot name="item" :item="item" :index="index" />
      </template>
      <template v-if="items.length === 0">
        <slot name="empty" />
      </template>
    </div>
  `,
}

function mountCard() {
  const pinia = createPinia()
  return mount(LibraryCard, {
    global: {
      plugins: [router, pinia],
      stubs: {
        ScrollableList: ScrollableListStub,
      },
    },
  })
}

describe('LibraryCard', () => {
  beforeEach(() => {
    mockTracks = []
    mockPlaylists = []
  })

  it('displays track count from store', () => {
    mockTracks = [{ trackID: 'a' }, { trackID: 'b' }, { trackID: 'c' }]
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('3 tracks')
  })

  it('displays playlist count from store', () => {
    mockPlaylists = [
      { id: 1, name: 'Blues', trackIDs: [] },
      { id: 2, name: 'Rock', trackIDs: [] },
    ]
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('2 playlists')
  })

  it('renders each playlist name', () => {
    mockPlaylists = [
      { id: 1, name: 'Blues Mix', trackIDs: ['x', 'y'] },
      { id: 2, name: 'Rock Mix', trackIDs: [] },
    ]
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Blues Mix')
    expect(wrapper.text()).toContain('Rock Mix')
  })

  it('renders trackIDs count per playlist row', () => {
    mockPlaylists = [{ id: 1, name: 'My List', trackIDs: ['a', 'b', 'c'] }]
    const wrapper = mountCard()
    // "3 tracks" appears in the playlist row meta
    const meta = wrapper.find('.library-card__meta')
    expect(meta.text()).toContain('3 tracks')
  })

  it('shows empty message when no playlists', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('No playlists yet')
  })
})
