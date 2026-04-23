import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ExportModal from '@/components/dashboard/ExportModal.vue'
import * as registry from '@/adapters/registry'
import type { Playlist } from '@/types/models'

const mockExport = vi.fn()

// Provide mock playlists so the inline playlist step is functional
const playlists: Playlist[] = [
  { id: 1, name: 'Test Playlist', trackIDs: ['a', 'b'] },
]

vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({ playlists }),
}))

vi.mock('@/stores/activity', () => ({
  useActivityStore: () => ({
    startOperation: vi.fn(),
    updateProgress: vi.fn(),
    completeOperation: vi.fn(),
    failOperation: vi.fn(),
  }),
}))

const mockAuthState = vi.hoisted(() => ({
  isAuthenticated: false,
}))
const mockLogin = vi.fn()

vi.mock('@/composables/useSpotifyAuth', async () => {
  const { ref } = await import('vue')
  return {
    useSpotifyAuth: () => ({
      isAuthenticated: ref(mockAuthState.isAuthenticated),
      login: mockLogin,
    }),
  }
})

vi.mock('@/spotify/pendingIntent', () => ({
  PENDING_ACTIONS: {
    OPEN_SPOTIFY_PICKER: 'open-spotify-picker',
    OPEN_SPOTIFY_EXPORTER: 'open-spotify-exporter',
    CONNECT_ONLY: 'connect-only',
  },
}))

// Stub ScrollableList to render items directly (no virtualizer DOM requirements)
const ScrollableListStub = {
  props: ['items', 'keyField', 'estimateSize'],
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

function mountOptions() {
  return { global: { stubs: { ScrollableList: ScrollableListStub } } }
}

function mountExport(props: Record<string, unknown> = {}) {
  return mount(ExportModal, { ...mountOptions(), props })
}

// Navigate from initial source step through playlist selection to the options step
async function toOptionsStep(wrapper: ReturnType<typeof mount>) {
  // Source step: choose Local Files
  await wrapper.find('.source-card').trigger('click')
  // Playlists step: select all then proceed
  await wrapper.find('.io-modal__select-all').trigger('click')
  await wrapper.find('button.btn--primary').trigger('click')
}

describe('ExportModal', () => {
  beforeEach(() => {
    mockExport.mockReset()
    mockLogin.mockReset()
    mockAuthState.isAuthenticated = false
    vi.spyOn(registry, 'getExporter').mockReturnValue({
      key: 'csv',
      label: 'CSV File',
      export: mockExport,
    })
  })

  it('renders format dropdown', async () => {
    const wrapper = mountExport()
    await toOptionsStep(wrapper)
    expect(wrapper.findAll('select').length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain('Format')
  })

  it('shows profile dropdown for CSV format', async () => {
    const wrapper = mountExport()
    await toOptionsStep(wrapper)
    expect(wrapper.text()).toContain('Profile')
  })

  it('disables profile dropdown when JSON format selected', async () => {
    const wrapper = mountExport()
    await toOptionsStep(wrapper)
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('json')
    // Profile is the second select; it should be disabled when JSON is chosen
    expect((selects[1]!.element as HTMLSelectElement).disabled).toBe(true)
  })

  it('calls getExporter with selected format on export click', async () => {
    mockExport.mockResolvedValue({ playlistsExported: 1, errors: [] })

    const wrapper = mountExport()
    await toOptionsStep(wrapper)
    await wrapper.find('button.btn--primary').trigger('click')
    await flushPromises()

    expect(registry.getExporter).toHaveBeenCalledWith('csv')
    expect(mockExport).toHaveBeenCalled()
  })

  it('clicking Export emits cancel to close the modal', async () => {
    mockExport.mockResolvedValue({ playlistsExported: 1, errors: [] })

    const wrapper = mountExport()
    await toOptionsStep(wrapper)
    await wrapper.find('button.btn--primary').trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('Cancel button emits cancel', async () => {
    const wrapper = mountExport()
    await wrapper.find('button.btn--secondary').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  // ── autoSpotify prop ────────────────────────────────────────────────────────
  it('autoSpotify:true with authenticated user skips source step and shows playlists', async () => {
    mockAuthState.isAuthenticated = true
    const wrapper = mountExport({ autoSpotify: true })
    await wrapper.vm.$nextTick()
    // Source step should be gone; playlist selection should be visible
    expect(wrapper.find('.source-card-grid').exists()).toBe(false)
    expect(wrapper.find('.io-modal__body--playlists').exists()).toBe(true)
  })

  it('autoSpotify:true when unauthenticated calls login with OPEN_SPOTIFY_EXPORTER action', async () => {
    mockAuthState.isAuthenticated = false
    const wrapper = mountExport({ autoSpotify: true })
    await wrapper.vm.$nextTick()
    expect(mockLogin).toHaveBeenCalledWith('open-spotify-exporter')
  })

  it('autoSpotify:false (default) stays on source step', () => {
    mockAuthState.isAuthenticated = true
    const wrapper = mountExport()
    expect(wrapper.find('.source-card-grid').exists()).toBe(true)
  })

  it('clicking Spotify source card calls login with OPEN_SPOTIFY_EXPORTER when not authenticated', async () => {
    mockAuthState.isAuthenticated = false
    const wrapper = mountExport()
    const cards = wrapper.findAll('.source-card')
    // Spotify card is the second one
    await cards[1]!.trigger('click')
    expect(mockLogin).toHaveBeenCalledWith('open-spotify-exporter')
  })
})