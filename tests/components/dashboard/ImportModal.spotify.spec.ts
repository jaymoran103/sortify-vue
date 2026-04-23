import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ImportModal from '@/components/dashboard/ImportModal.vue'
import SpotifyPlaylistPickerModal from '@/components/dashboard/SpotifyPlaylistPickerModal.vue'

const testState = vi.hoisted(() => ({
  mockOpen: vi.fn(),
  mockLogin: vi.fn(),
  authValues: {
    isAuthenticated: true,
    isLoading: false,
  },
}))

vi.mock('@/composables/useModal', () => ({
  useModal: () => ({
    open: testState.mockOpen,
    close: vi.fn(),
  }),
}))

vi.mock('@/composables/useSpotifyAuth', async () => {
  const { ref } = await import('vue')
  return {
    useSpotifyAuth: () => ({
      isAuthenticated: ref(testState.authValues.isAuthenticated),
      user: ref(null),
      isLoading: ref(testState.authValues.isLoading),
      error: ref(null),
      pendingAction: ref(null),
      login: testState.mockLogin,
      logout: vi.fn(),
      clearPendingAction: vi.fn(),
      handleCallback: vi.fn(),
    }),
  }
})

vi.mock('@/spotify/pendingIntent', () => ({
  PENDING_ACTIONS: {
    OPEN_SPOTIFY_PICKER: 'open-spotify-picker',
    CONNECT_ONLY: 'connect-only',
  },
}))

describe('ImportModal Spotify source', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    testState.mockOpen.mockReset()
    testState.mockOpen.mockResolvedValue(null)
    testState.mockLogin.mockReset()
    testState.mockLogin.mockResolvedValue(undefined)
    testState.authValues.isAuthenticated = true
    testState.authValues.isLoading = false
  })

  it('opens SpotifyPlaylistPickerModal when already authenticated', async () => {
    const wrapper = mount(ImportModal)

    await wrapper.findAll('.source-card')[1]!.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(testState.mockOpen).toHaveBeenCalledWith(SpotifyPlaylistPickerModal)
  })

  it('starts login instead of opening the picker when unauthenticated', async () => {
    testState.authValues.isAuthenticated = false
    const wrapper = mount(ImportModal)

    await wrapper.findAll('.source-card')[1]!.trigger('click')

    expect(testState.mockLogin).toHaveBeenCalled()
    expect(testState.mockOpen).not.toHaveBeenCalled()
    expect(wrapper.emitted('cancel')).toBeFalsy()
  })

  it('login called with open-spotify-picker when Spotify clicked while unauthenticated', async () => {
    testState.authValues.isAuthenticated = false
    const wrapper = mount(ImportModal)

    await wrapper.findAll('.source-card')[1]!.trigger('click')

    expect(testState.mockLogin).toHaveBeenCalledWith('open-spotify-picker')
  })

  // ── autoSpotify prop ──────────────────────────────────────────────────────
  it('autoSpotify=true immediately triggers openSpotifyImport on mount when authenticated', async () => {
    testState.authValues.isAuthenticated = true
    mount(ImportModal, { props: { autoSpotify: true } })
    await flushPromises()

    expect(testState.mockOpen).toHaveBeenCalledWith(SpotifyPlaylistPickerModal)
  })

  it('autoSpotify=true calls login("open-spotify-picker") on mount when unauthenticated', async () => {
    testState.authValues.isAuthenticated = false
    mount(ImportModal, { props: { autoSpotify: true } })
    await flushPromises()

    expect(testState.mockLogin).toHaveBeenCalledWith('open-spotify-picker')
    expect(testState.mockOpen).not.toHaveBeenCalled()
  })

  it('autoSpotify=false (default) does not auto-trigger on mount', async () => {
    mount(ImportModal)
    await flushPromises()

    expect(testState.mockLogin).not.toHaveBeenCalled()
    expect(testState.mockOpen).not.toHaveBeenCalled()
  })
})