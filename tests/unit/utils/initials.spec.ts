import { describe, it, expect } from 'vitest'
import { initialsOf } from '@/utils/initials'

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Chill Hop')).toBe('CH')
  })

  it('splits on underscores, dashes and apostrophes', () => {
    expect(initialsOf('most_played_-_Jan')).toBe('MP')
  })

  it('prefers words that start with a letter', () => {
    expect(initialsOf('2014_clock_radio')).toBe('CR')
  })

  it('keeps two digits for a name with no letters', () => {
    expect(initialsOf("'18_")).toBe('18')
  })

  it('ignores emoji', () => {
    expect(initialsOf('Morning_Music_🕺')).toBe('MM')
  })

  it('returns an empty string for a name with no letters or digits', () => {
    expect(initialsOf('___')).toBe('')
  })
})
