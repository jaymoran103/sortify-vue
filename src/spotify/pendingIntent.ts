const PENDING_INTENT_KEY = 'spotify_pending_intent'

export interface PendingIntent {
  // One of the PENDING_ACTIONS values
  action: string
  // window.location.hash at the time login() was called, like '#/dashboard' or '#/'
  returnRoute: string
}

export const PENDING_ACTIONS = {
  OPEN_SPOTIFY_PICKER: 'open-spotify-picker',
  OPEN_SPOTIFY_EXPORTER: 'open-spotify-exporter',
  CONNECT_ONLY: 'connect-only',
} as const

export type PendingActionKey = (typeof PENDING_ACTIONS)[keyof typeof PENDING_ACTIONS]

// Saves a pending intent to localStorage before the PKCE redirect.
// localStorage survives the browser navigation; sessionStorage does not reliably in all browsers.
export function savePendingIntent(intent: PendingIntent): void {
  localStorage.setItem(PENDING_INTENT_KEY, JSON.stringify(intent))
}

// Reads and removes the pending intent from localStorage.
// Wraps JSON.parse in try/catch — corrupted storage must never throw or block app startup.
// Returns null when no intent is stored or when the stored value cannot be parsed.
export function consumePendingIntent(): PendingIntent | null {
  const raw = localStorage.getItem(PENDING_INTENT_KEY)
  localStorage.removeItem(PENDING_INTENT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingIntent
  } catch {
    return null
  }
}
