import { describe, it, expect } from 'vitest'
import { initials } from '@/utils/initials'

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Road Trip Mix')).toBe('RT')
  })

  it('takes the first two letters of a single word', () => {
    expect(initials('Chill')).toBe('CH')
  })

  it('upper-cases the result', () => {
    expect(initials('late night')).toBe('LN')
  })

  it('ignores extra whitespace', () => {
    expect(initials('  Seed   1 ')).toBe('S1')
  })

  it('keeps an emoji whole', () => {
    expect(initials('🔥 Hits')).toBe('🔥H')
  })

  it('falls back to ? for a blank name', () => {
    expect(initials('   ')).toBe('?')
  })
})
