import type { Component } from 'vue'

/** Generic filter function — consumers define domain-specific matching logic */
export type FilterFn<T> = (item: T, query: string) => boolean

/** Sort option for SelectDropdown — consumers define their own sort menus */
export interface SortOption<T> {
  key: string
  label: string
  compareFn: (a: T, b: T) => number
}

/** Context menu / dropdown menu entries */
export interface MenuItem {
  label: string
  action: () => void
  disabled?: boolean
}

export interface MenuDivider {
  divider: true
}

export type MenuEntry = MenuItem | MenuDivider

/** Modal configuration passed to useModal().open() */
export interface ModalConfig {
  component: Component
  props?: Record<string, unknown>
  className?: string
}

/** Notification/toast for non-blocking feedback */
export interface ToastConfig {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}
// --- Activity / Operation tracking types ---

export type OperationStatus = 'pending' | 'active' | 'done' | 'error'
// FUTURE: Define operation types to link 
// export type OperationType = 'io-JSON' | 'io-CSV' | 'io-Spotify' | 'other' | 'state'

export interface OperationProgress {
  done: number
  total: number
  itemLabel?: string   // TODO Determine exact schema: current playlist, category, or item, depending on operation type
  phase?: string       // 'Fetching playlists', 'Importing tracks' FUTURE add these as a type?
}

export interface ActivityError {
  category: string   // TODO Determine exact schema: file format, missing core fields, network issue, 403 (likely someone else's playlist)
  message: string    // human-readable explanation
  items: string[]    // affected playlist/track names
}

export interface ActivityItem {
  id: string
  label: string
  status: OperationStatus
  progress: OperationProgress | null   // null = indeterminate
  errors: ActivityError[]
  startedAt: number
  completedAt?: number
}