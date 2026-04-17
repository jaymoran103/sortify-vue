import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SpotifyPlaylistPickerModal from '@/components/dashboard/SpotifyPlaylistPickerModal.vue'
import { useActivityStore } from '@/stores/activity'

const testState = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockSpotifyImport: vi.fn(),
  mockLogin: vi.fn(),
  authValues: {
    isAuthenticated: true,
    isLoading: false,
  },
}))

vi.mock('@/spotify/api', () => ({
  spotifyApi: {
    get: testState.mockApiGet,
  },
}))

vi.mock('@/adapters/registry', () => ({
  getImporter: vi.fn(() => ({
    key: 'spotify',
    label: 'Spotify',
    import: testState.mockSpotifyImport,
  })),
}))

vi.mock('@/composables/useSpotifyAuth', async () => {
  const { ref } = await import('vue')
  return {
    useSpotifyAuth: () => ({
      isAuthenticated: ref(testState.authValues.isAuthenticated),
      user: ref(null),
      isLoading: ref(testState.authValues.isLoading),
      error: ref(null),
      login: testState.mockLogin,
      logout: vi.fn(),
      handleCallback: vi.fn(),
    }),
  }
})

const ScrollableListStub = {
  props: ['items'],
  template: `
    <div>
      <template v-if="items.length === 0">
        <slot name="empty" />
      </template>
      <template v-else v-for="(item, index) in items" :key="index">
        <slot name="item" :item="item" :index="index" />
      </template>
    </div>
  `,
}

function mountModal() {
  return mount(SpotifyPlaylistPickerModal, {
    global: {
      plugins: [createPinia()],
      stubs: { ScrollableList: ScrollableListStub },
    },
  })
}

describe('SpotifyPlaylistPickerModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    testState.mockApiGet.mockReset()
    testState.mockSpotifyImport.mockReset()
    testState.mockLogin.mockReset()
    testState.authValues.isAuthenticated = true
    testState.authValues.isLoading = false
  })

  it('loads and renders Spotify playlists on mount', async () => {
    testState.mockApiGet.mockResolvedValue({
      items: [
        {
          id: 'pl-1',
          name: 'Morning Mix',
          tracks: { total: 12 },
          owner: { display_name: 'Alice' },
          images: [],
        },
      ],
      total: 1,
      next: null,
      offset: 0,
      limit: 50,
    })

    const wrapper = mountModal()
    await flushPromises()

    expect(testState.mockApiGet).toHaveBeenCalledWith('/me/playlists?limit=50')
    expect(wrapper.text()).toContain('Morning Mix')
    expect(wrapper.text()).toContain('12 tracks')
  })

  it('closes the modal and starts importing selected playlists', async () => {
    testState.mockApiGet.mockResolvedValue({
      items: [
        {
          id: 'pl-1',
          name: 'Morning Mix',
          tracks: { total: 12 },
          owner: { display_name: 'Alice' },
          images: [],
        },
      ],
      total: 1,
      next: null,
      offset: 0,
      limit: 50,
    })
    testState.mockSpotifyImport.mockResolvedValue({
      tracksImported: 12,
      playlistsImported: 1,
      errors: [],
    })

    const wrapper = mountModal()
    await flushPromises()

    await wrapper.find('.selectable-item').trigger('click')
    await wrapper.find('button.btn--primary').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(testState.mockSpotifyImport).toHaveBeenCalledWith(
      {
        playlists: [
          {
            id: 'pl-1',
            name: 'Morning Mix',
            tracks: { total: 12 },
            owner: { display_name: 'Alice' },
            images: [],
          },
        ],
      },
      expect.any(Function),
    )
  })

  it('shows connect action when Spotify is not authenticated', async () => {
    testState.authValues.isAuthenticated = false

    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain('Spotify is not connected')
    await wrapper.find('button.btn--secondary').trigger('click')
    expect(testState.mockLogin).toHaveBeenCalled()
  })

  it('falls back safely when Spotify returns incomplete playlist data', async () => {
    testState.mockApiGet.mockResolvedValue({
      items: [
        {
          id: 'pl-1',
          name: 'Incomplete Mix',
          owner: {},
          images: [],
        },
      ],
      total: 1,
      next: null,
      offset: 0,
      limit: 50,
    })

    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain('Incomplete Mix')
    expect(wrapper.text()).toContain('0 tracks - Unknown owner')
  })

  it('uses adapter-reported Spotify totals for activity progress', async () => {
    testState.mockApiGet.mockResolvedValue({
      items: [
        {
          id: 'pl-1',
          name: 'Morning Mix',
          tracks: { total: 0 },
          owner: { display_name: 'Alice' },
          images: [],
        },
      ],
      total: 1,
      next: null,
      offset: 0,
      limit: 50,
    })
    testState.mockSpotifyImport.mockImplementation(async (_options, onProgress) => {
      onProgress?.(1, 5, 'Morning Mix')
      return {
        tracksImported: 5,
        playlistsImported: 1,
        errors: [],
      }
    })

    const wrapper = mountModal()
    const activityStore = useActivityStore()
    await flushPromises()

    await wrapper.find('.selectable-item').trigger('click')
    await wrapper.find('button.btn--primary').trigger('click')
    await flushPromises()

    expect(activityStore.activeOperation?.progress).toEqual({
      done: 1,
      total: 5,
      phase: 'Importing Spotify',
      itemLabel: 'Morning Mix',
    })
  })
})