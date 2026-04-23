import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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
      login: testState.mockLogin,
      logout: vi.fn(),
      handleCallback: vi.fn(),
    }),
  }
})

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
})