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

// Repeats inside one playlist, cleaned up a playlist at a time
const repeats: DoublesDraft = {
  key: 'repeats',
  name: 'Repeats in a playlist',
  tabs: [
    { label: 'Find the repeats', sub: 'See which playlists hold the same song more than once.' },
    { label: 'Choose what stays', sub: 'Pick one version for each playlist. Each can choose differently.' },
    { label: 'Clean it up', sub: 'Every playlist keeps one copy, and nothing else moves.' },
  ],
  states: [
    {
      ...base, meta: '2 playlists with repeats', status: '', action: 'Review',
      focusCol: { index: 1, note: '3 versions' },
      rows: [
        { ...studio,  cols: [1, 0, 1, 0] },
        { ...live,    cols: [0, 1, 0, 0] },
        { ...dead,    cols: [0, 1, 1, 0] },
        { ...clapton, cols: [0, 1, 0, 1] },
      ],
    },
    {
      ...base, meta: '2 playlists with repeats', status: 'Choosing', action: 'Apply',
      focusCol: { index: 1, note: 'pick one' },
      rows: [
        { ...studio,  cols: [1, 0, 'picked', 0] },
        { ...live,    cols: [0, 'pick', 0, 0] },
        { ...dead,    cols: [0, 'picked', 'pick', 0] },
        { ...clapton, cols: [0, 'pick', 0, 1] },
      ],
    },
    {
      ...base, meta: 'No repeats left', status: 'Unsaved changes', action: 'Save', actionPrimary: true,
      rows: [
        { ...studio,  cols: [1, 0, 1, 0] },
        { ...live,    cols: [0, 'rm', 0, 0] },
        { ...dead,    cols: [0, 1, 'rm', 0] },
        { ...clapton, cols: [0, 'rm', 0, 1] },
      ],
    },
  ],
}

// Trade one version for another wherever it appears
const swap: DoublesDraft = {
  key: 'swap',
  name: 'Swap a version',
  tabs: [
    { label: 'Pick a favorite', sub: 'Found a take you like better? Start from that one.' },
    { label: 'Preview the swap', sub: 'See every playlist it would change before anything does.' },
    { label: 'Swap everywhere', sub: 'One click. Each playlist keeps its order.' },
  ],
  states: [
    {
      ...base, meta: '4 versions · 4 playlists', status: '', action: 'Swap in',
      rows: [
        { ...studio,  cols: [1, 0, 1, 0] },
        { ...live,    cols: [0, 1, 0, 0] },
        { ...dead,    cols: [0, 0, 0, 0], mark: 'preferred' },
        { ...clapton, cols: [0, 0, 0, 1] },
      ],
    },
    {
      ...base, meta: 'Swap in: Bob Dylan, Grateful Dead', status: 'Preview', action: 'Swap in',
      rows: [
        { ...studio,  cols: ['rm', 0, 'rm', 0], mark: 'muted' },
        { ...live,    cols: [0, 'rm', 0, 0], mark: 'muted' },
        { ...dead,    cols: ['add', 'add', 'add', 0], mark: 'preferred' },
        { ...clapton, cols: [0, 0, 0, 1] },
      ],
    },
    {
      ...base, meta: 'Swapped in 3 playlists', status: 'Unsaved changes', action: 'Save', actionPrimary: true,
      rows: [
        { ...dead,    cols: [1, 1, 1, 0], mark: 'preferred' },
        { ...clapton, cols: [0, 0, 0, 1] },
      ],
    },
  ],
}

// How sure the match is: exact copies, other takes, covers
const matchStrength: DoublesDraft = {
  key: 'strength',
  name: 'How sure the match is',
  tabs: [
    { label: 'Exact copies', sub: 'The same recording, saved twice from different releases.' },
    { label: 'Other takes', sub: 'Live, remastered or alternate takes by the same artist.' },
    { label: 'Covers', sub: 'Other artists, same song. Off unless you ask for them.' },
  ],
  states: [
    {
      ...base, meta: 'Same recording · 2 releases', status: '', action: 'Merge',
      focusCol: { index: 0, note: 'twice' },
      rows: [
        { ...studio, cols: [1, 0, 1, 0] },
        { ...studio, cols: [1, 1, 0, 0] },
      ],
    },
    {
      ...base, meta: 'Same artist · 3 takes', status: '', action: 'Review',
      rows: [
        { ...studio, cols: [1, 0, 1, 0] },
        { ...live,   cols: [0, 1, 0, 0] },
        { ...dead,   cols: [0, 1, 1, 0] },
      ],
    },
    {
      ...base, meta: 'Other artist · 1 cover', status: 'Covers shown', action: 'Review',
      rows: [
        { ...studio,  cols: [1, 0, 1, 0] },
        { ...clapton, cols: [0, 1, 0, 1] },
      ],
    },
  ],
}

// Every version as something to enjoy, not clean up
const collect: DoublesDraft = {
  key: 'collect',
  name: 'Collect every version',
  tabs: [
    { label: 'See every version', sub: 'All the takes of a song you have saved, side by side.' },
    { label: 'Hear the difference', sub: 'Play each version straight from the list.' },
    { label: 'Save the set', sub: 'Gather them into a playlist of their own.' },
  ],
  states: [
    {
      ...base, meta: '4 versions · 4 playlists', status: '', action: 'New playlist',
      rows: [
        { ...studio,  cols: [1, 0, 1, 0] },
        { ...live,    cols: [0, 1, 0, 0] },
        { ...dead,    cols: [0, 1, 1, 0] },
        { ...clapton, cols: [0, 1, 0, 1] },
      ],
    },
    {
      ...base, meta: 'Now playing: Bob Dylan, Grateful Dead', status: '', action: 'New playlist',
      rows: [
        { ...studio,  cols: [1, 0, 1, 0] },
        { ...live,    cols: [0, 1, 0, 0] },
        { ...dead,    cols: [0, 1, 1, 0], mark: 'playing' },
        { ...clapton, cols: [0, 1, 0, 1] },
      ],
    },
    {
      ...base, meta: '4 versions · 5 playlists', status: 'Unsaved changes', action: 'Save', actionPrimary: true,
      playlists: [...PLAYLISTS, "Heaven's Door, every take"],
      focusCol: { index: 4, note: 'new' },
      rows: [
        { ...studio,  cols: [1, 0, 1, 0, 'add'] },
        { ...live,    cols: [0, 1, 0, 0, 'add'] },
        { ...dead,    cols: [0, 1, 1, 0, 'add'] },
        { ...clapton, cols: [0, 1, 0, 1, 'add'] },
      ],
    },
  ],
}

export const DOUBLES_DRAFTS: DoublesDraft[] = [tidyUp, repeats, swap, matchStrength, collect]
