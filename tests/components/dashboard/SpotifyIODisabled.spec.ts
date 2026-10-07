import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ImportModal from '@/components/dashboard/ImportModal.vue'
import ExportModal from '@/components/dashboard/ExportModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'

// SPOTIFY_IO_ENABLED is false in the real config, so these tests use it unmocked.

const state = vi.hoisted(() => ({ mockOpen: vi.fn(), mockLogin: vi.fn() }))

vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: state.mockOpen, close: vi.fn() }),
}))

vi.mock('@/composables/useSpotifyAuth', async () => {
  const { ref } = await import('vue')
  return {
    useSpotifyAuth: () => ({
      isAuthenticated: ref(false),
      isLoading: ref(false),
      login: state.mockLogin,
    }),
  }
})

vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({ playlists: [] }),
}))

describe('Spotify I/O while disabled', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    state.mockOpen.mockReset()
    state.mockLogin.mockReset()
  })

  it('import offers Exportify in place of Spotify', () => {
    const wrapper = mount(ImportModal)
    const labels = wrapper.findAll('.source-card__label').map((l) => l.text())
    expect(labels).toEqual(['Local Files', 'Spotify via Exportify'])
  })

  it('import warns first, then opens exportify.net on confirm', async () => {
    state.mockOpen.mockResolvedValue(true)
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const wrapper = mount(ImportModal)
    await wrapper.findAll('.source-card')[1]!.trigger('click')
    await flushPromises()
    expect(state.mockOpen).toHaveBeenCalledWith(ConfirmModal, expect.objectContaining({ confirmLabel: 'Open Exportify' }))
    expect(openSpy).toHaveBeenCalledWith('https://exportify.net', '_blank', 'noopener')
    expect(state.mockLogin).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('import does not open exportify.net when the warning is cancelled', async () => {
    state.mockOpen.mockResolvedValue(null)
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const wrapper = mount(ImportModal)
    await wrapper.findAll('.source-card')[1]!.trigger('click')
    await flushPromises()
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('export shows Spotify disabled and does not start a login', async () => {
    const wrapper = mount(ExportModal)
    const spotify = wrapper.findAll('.source-card')[1]!
    expect(spotify.attributes('disabled')).toBeDefined()
    expect(spotify.text()).toContain('Not available yet')
    await spotify.trigger('click')
    expect(state.mockLogin).not.toHaveBeenCalled()
  })
})
