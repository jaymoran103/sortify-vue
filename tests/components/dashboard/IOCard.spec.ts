import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import IOCard from '@/components/dashboard/IOCard.vue'
import ImportModal from '@/components/dashboard/ImportModal.vue'
import ExportModal from '@/components/dashboard/ExportModal.vue'

const mockOpen = vi.fn()
vi.mock('@/composables/useModal', () => ({
  useModal: () => ({ open: mockOpen, close: vi.fn() }),
}))

let mockPlaylists: unknown[] = []
vi.mock('@/stores/playlists', () => ({
  usePlaylistStore: () => ({ playlists: mockPlaylists }),
}))

// Mutable auth state controlled per-test
const mockAuthState = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null as null | { display_name: string },
  isLoading: false,
  error: null as string | null,
  pendingAction: null as string | null,
}))
const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockClearPendingAction = vi.fn()

vi.mock('@/composables/useSpotifyAuth', async () => {
  const { ref } = await import('vue')
  return {
    useSpotifyAuth: () => ({
      isAuthenticated: ref(mockAuthState.isAuthenticated),
      user: ref(mockAuthState.user),
      isLoading: ref(mockAuthState.isLoading),
      error: ref(mockAuthState.error),
      pendingAction: ref(mockAuthState.pendingAction),
      login: mockLogin,
      logout: mockLogout,
      clearPendingAction: mockClearPendingAction,
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

function mountCard() {
  return mount(IOCard, {
    global: { plugins: [createPinia()] },
  })
}

describe('IOCard', () => {
  beforeEach(() => {
    mockOpen.mockClear()
    mockLogin.mockClear()
    mockLogout.mockClear()
    mockClearPendingAction.mockClear()
    mockPlaylists = []
    mockAuthState.isAuthenticated = false
    mockAuthState.user = null
    mockAuthState.isLoading = false
    mockAuthState.error = null
    mockAuthState.pendingAction = null
  })

  it('shows Spotify placeholder text', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Spotify not connected')
  })

  it('Import button calls modal.open with ImportModal', async () => {
    const wrapper = mountCard()
    await wrapper.find('#import-button').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(ImportModal)
  })

  it('Export button is disabled when library is empty', () => {
    const wrapper = mountCard()
    const exportBtn = wrapper.find('#export-button')
    expect((exportBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Export button has a tooltip when library is empty', () => {
    const wrapper = mountCard()
    const exportBtn = wrapper.find('#export-button')
    expect(exportBtn.attributes('title')).toBeTruthy()
  })

  it('Export button is enabled when playlists exist', () => {
    mockPlaylists = [{ id: 1, name: 'Mix', trackIDs: [] }]
    const wrapper = mountCard()
    const exportBtn = wrapper.find('#export-button')
    expect((exportBtn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('Export button has no tooltip when playlists exist', () => {
    mockPlaylists = [{ id: 1, name: 'Mix', trackIDs: [] }]
    const wrapper = mountCard()
    const exportBtn = wrapper.find('#export-button')
    expect(exportBtn.attributes('title')).toBeFalsy()
  })

  it('Export button calls modal.open with ExportModal when playlists exist', async () => {
    mockPlaylists = [{ id: 1, name: 'Mix', trackIDs: [] }]
    const wrapper = mountCard()
    await wrapper.find('#export-button').trigger('click')
    expect(mockOpen).toHaveBeenCalledWith(ExportModal)
  })

  // ── Pending action on mount ──────────────────────────────────────────────
  it('opens ImportModal with autoSpotify:true when pending action is open-spotify-picker', () => {
    mockAuthState.pendingAction = 'open-spotify-picker'
    mountCard()
    expect(mockClearPendingAction).toHaveBeenCalled()
    expect(mockOpen).toHaveBeenCalledWith(ImportModal, { autoSpotify: true })
  })

  it('does not open any modal when pending action is null', () => {
    mockAuthState.pendingAction = null
    mountCard()
    expect(mockOpen).not.toHaveBeenCalled()
  })

  it('does not open any modal when pending action is connect-only', () => {
    mockAuthState.pendingAction = 'connect-only'
    mountCard()
    expect(mockOpen).not.toHaveBeenCalled()
  })

  it('calls clearPendingAction before opening the modal to prevent re-firing', () => {
    mockAuthState.pendingAction = 'open-spotify-picker'
    const callOrder: string[] = []
    mockClearPendingAction.mockImplementation(() => callOrder.push('clear'))
    mockOpen.mockImplementation(() => { callOrder.push('open'); return Promise.resolve() })
    mountCard()
    expect(callOrder[0]).toBe('clear')
    expect(callOrder[1]).toBe('open')
  })
})
