// Demo content for the about page's doubles showcase.
// Each draft is one emphasis: three tabs, and the workspace state each tab shows.

/**
 * One playlist cell.
 * 0 / 1: absent / present. 'add' / 'rm': present / absent after a change, marked as changed.
 * 'keep': present, kept on purpose as an exception. 'pick' / 'picked': a choice not yet applied.
 */
export type DoublesCell = 0 | 1 | 'add' | 'rm' | 'keep' | 'pick' | 'picked'

export interface DoublesRow {
  title: string
  artist: string
  cols: DoublesCell[]
  mark?: 'preferred' | 'muted' | 'playing'
}

export interface DoublesState {
  title: string
  meta: string
  status: string
  action: string
  actionPrimary?: boolean
  playlists: string[]
  /** Column index to highlight, with a short note under its name */
  focusCol?: { index: number; note: string }
  /** Hide the playlist columns, leaving only the list of versions */
  folded?: boolean
  rows: DoublesRow[]
}

export interface DoublesDraft {
  key: string
  name: string
  tabs: { label: string; sub: string }[]
  states: [DoublesState, DoublesState, DoublesState]
}

const SONG = "Knockin' on Heaven's Door"
const PLAYLISTS = ['Dylan Essentials', 'Road Trip', 'Sunday Morning', 'Guitar Heroes']

const studio = { title: SONG, artist: 'Bob Dylan' }
const live = { title: `${SONG} - Live`, artist: 'Bob Dylan' }
const dead = { title: `${SONG} - Live`, artist: 'Bob Dylan, Grateful Dead' }
const clapton = { title: SONG, artist: 'Eric Clapton' }

const base = { title: SONG, playlists: PLAYLISTS }

const tidyUp: DoublesDraft = {
  key: 'tidy',
  name: 'Keep one version',
  tabs: [
    { label: 'Spot the versions', sub: 'Studio cuts, live takes and covers of one song, grouped together.' },
    { label: 'See where they live', sub: 'Every version, across every playlist that holds one.' },
    { label: 'Keep one', sub: 'Swap in a single version everywhere. Keep the exceptions you want.' },
  ],
  states: [
    {
      ...base, meta: '4 versions', status: '', action: 'Keep one', folded: true,
      rows: [
        { ...studio,  cols: [1, 0, 1, 0] },
        { ...live,    cols: [0, 1, 0, 0] },
        { ...dead,    cols: [0, 1, 1, 0] },
        { ...clapton, cols: [0, 1, 0, 1] },
      ],
    },
    {
      ...base, meta: '4 versions · 4 playlists', status: '', action: 'Keep one',
      rows: [
        { ...studio,  cols: [1, 0, 1, 0] },
        { ...live,    cols: [0, 1, 0, 0] },
        { ...dead,    cols: [0, 1, 1, 0] },
        { ...clapton, cols: [0, 1, 0, 1] },
      ],
    },
    {
      ...base, meta: '4 versions · 4 playlists', status: 'Unsaved changes', action: 'Save', actionPrimary: true,
      rows: [
        { ...studio,  cols: [1, 'add', 1, 0], mark: 'preferred' },
        { ...live,    cols: [0, 'rm', 0, 0], mark: 'muted' },
        { ...dead,    cols: [0, 'rm', 'rm', 0], mark: 'muted' },
        { ...clapton, cols: [0, 'rm', 0, 'keep'] },
      ],
    },
  ],
}

export const DOUBLES_DRAFTS: DoublesDraft[] = [tidyUp]
