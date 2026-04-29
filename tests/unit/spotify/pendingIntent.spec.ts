import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumePendingIntent,
  PENDING_ACTIONS,
  savePendingIntent,
} from '@/spotify/pendingIntent'

const STORAGE_KEY = 'spotify_pending_intent'

// jsdom's localStorage.clear() is not implemented; use the same manual stub as auth.spec.ts
const localStorageData: Record<string, string> = {}
const localStorageMock: Storage = {
  getItem: (key) => localStorageData[key] ?? null,
  setItem: (key, value) => { localStorageData[key] = String(value) },
  removeItem: (key) => { delete localStorageData[key] },
  clear: () => { for (const key in localStorageData) delete localStorageData[key] },
  key: (index) => Object.keys(localStorageData)[index] ?? null,
  get length() { return Object.keys(localStorageData).length },
}

describe('pendingIntent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock)
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('savePendingIntent', () => {
    it('writes a serialized PendingIntent to localStorage', () => {
      savePendingIntent({ action: PENDING_ACTIONS.OPEN_SPOTIFY_PICKER, returnRoute: '#/dashboard' })
      const stored = localStorage.getItem(STORAGE_KEY)
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed).toEqual({ action: 'open-spotify-picker', returnRoute: '#/dashboard' })
    })

    it('overwrites an existing pending intent', () => {
      savePendingIntent({ action: PENDING_ACTIONS.CONNECT_ONLY, returnRoute: '#/' })
      savePendingIntent({ action: PENDING_ACTIONS.OPEN_SPOTIFY_PICKER, returnRoute: '#/dashboard' })
      const stored = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(stored!)
      expect(parsed.action).toBe(PENDING_ACTIONS.OPEN_SPOTIFY_PICKER)
    })
  })

  describe('consumePendingIntent', () => {
    it('returns the stored intent and removes the key', () => {
      savePendingIntent({ action: PENDING_ACTIONS.OPEN_SPOTIFY_PICKER, returnRoute: '#/dashboard' })
      const result = consumePendingIntent()
      expect(result).toEqual({ action: 'open-spotify-picker', returnRoute: '#/dashboard' })
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('returns null when no intent is stored', () => {
      const result = consumePendingIntent()
      expect(result).toBeNull()
    })

    it('returns null and clears the key when stored JSON is corrupted', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json {{{{')
      const result = consumePendingIntent()
      expect(result).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('does not throw when localStorage is empty', () => {
      expect(() => consumePendingIntent()).not.toThrow()
    })
  })

  describe('PENDING_ACTIONS constants', () => {
    it('OPEN_SPOTIFY_PICKER has the expected value', () => {
      expect(PENDING_ACTIONS.OPEN_SPOTIFY_PICKER).toBe('open-spotify-picker')
    })

    it('CONNECT_ONLY has the expected value', () => {
      expect(PENDING_ACTIONS.CONNECT_ONLY).toBe('connect-only')
    })
  })
})
