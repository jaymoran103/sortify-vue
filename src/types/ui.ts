import type { Component } from 'vue'
import type { PlaylistId, Track, WorkspacePlaylist } from '@/types/models'

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

/** What AddContentModal resolves with — the card the user picked, not the work itself */
export type AddContentChoice = 'tracks' | 'playlist' | 'new'

/** What LeaveWorkspaceModal resolves with; null (dismissed) means stay */
export type LeaveChoice = 'save' | 'leave'

/**
 * How bad a workspace condition is, not where it is shown.
 *   loss    - leaving destroys work. Blocks the exit.
 *   quality - the state is probably not what the user meant. Never blocks.
 */
export type IssueSeverity = 'loss' | 'quality'

/** One reported condition of the workspace. See utils/workspaceIssues.ts */
export interface WorkspaceIssue {
  code: 'unsaved-changes' | 'unassigned-tracks' | 'empty-playlist'
  severity: IssueSeverity
  message: string
  /** Playlist or track ids the issue concerns, for consumers that highlight them */
  ids: string[]
}

/** Plain state the issue rules read — no store, so the rules stay pure and testable */
export interface WorkspaceSnapshot {
  playlists: WorkspacePlaylist[]
  modifiedIds: Set<PlaylistId>
  stableOrder: string[]
  tracks: Map<string, Track>
}

/** Notification/toast for non-blocking feedback */
export interface ToastConfig {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}
// --- Activity / Operation tracking types ---

export type OperationStatus = 'pending' | 'active' | 'done' | 'error'
export type OperationSource =
  | 'file-import'
  | 'file-export'
  | 'spotify-import'
  | 'spotify-export'

// Progress update callback, used by adapters to report progress back to the activity store for display in the ActivityIndicator and IOSummaryCard.
export interface OperationProgress {
  done: number
  total: number
  itemLabel?: string   // TODO Determine exact schema: current playlist, category, or item, depending on operation type
  phase?: string       // 'Fetching playlists', 'Importing tracks' FUTURE add these as a type?
}

// Activity summary info, displayed in the IOSummaryCard when an operation is complete. 
// Schema is flexible to accommodate different types of summaries for different operation types, but currently focused on counts of imported/exported items and any relevant links.
export interface ActivitySummary {
  tracks?: number
  playlists?: number
  warnings?: number
  linkItems?: Array<{ label: string; href: string }>
}

//TODO Deprecate in favor of a summary config?
export interface ActivityError {
  category: string   // TODO Determine exact schema: file format, missing core fields, network issue, 403 (likely someone else's playlist)
  message: string    // human-readable explanation
  items: string[]    // affected playlist/track names
}

// Main interface for an activity/operation item, stored in the activity store and displayed in the IOSummaryCard.
export interface ActivityItem {
  id: string
  label: string
  status: OperationStatus
  progress: OperationProgress | null   // null = indeterminate
  errors: ActivityError[]
  startedAt: number
  completedAt?: number
  source?: OperationSource     // operation type, used for IOSummaryCard label
  summary?: ActivitySummary    // result counts and links, set on completeOperation
}