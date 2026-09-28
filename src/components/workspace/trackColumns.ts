import type { Track } from '@/types/models'
import { formatDuration } from '@/utils/formatDuration'

// Optional track columns shown after the Track column. Which ones show, and how wide, is
// page state in WorkspaceView, like sort and open playlist columns, so it resets on reload.
// Each key is also the key of its sort option in WorkspaceView, so a header click sorts by it.
export type TrackColumnKey = 'artist' | 'album' | 'duration' | 'source'

// Drag limits. Narrow enough for a length, wide enough for a long album name.
export const TRACK_COLUMN_MIN_WIDTH_PX = 48
export const TRACK_COLUMN_MAX_WIDTH_PX = 480

export interface TrackColumn {
  key: TrackColumnKey
  label: string
  // Fixed width, so Fit to screen can count it.
  widthPx: number
  value: (track: Track) => string
}

// In display order. Shown columns always keep this order, whatever order they were picked.
export const TRACK_COLUMNS: readonly TrackColumn[] = [
  { key: 'artist', label: 'Artist', widthPx: 160, value: (t) => t.artist },
  { key: 'album', label: 'Album', widthPx: 160, value: (t) => t.album },
  { key: 'duration', label: 'Length', widthPx: 64, value: (t) => formatDuration(t.duration) },
  { key: 'source', label: 'Source', widthPx: 80, value: (t) => t.source },
]
