import { describe, it, expect } from 'vitest'
import { initials } from '@/utils/initials'

describe('initials', () => {
  it('takes the first letter of every word', () => {
    expect(initials('Road Trip Mix')).toBe('RTM')
  })

  it('takes one letter from a single word', () => {
    expect(initials('Madeup')).toBe('M')
  })

  it('keeps a number word whole', () => {
    expect(initials('recency 12 months')).toBe('R12M')
  })

  it('keeps numbers inside a word', () => {
    expect(initials('Spacebar2')).toBe('S2')
  })

  it('skips leading punctuation', () => {
    expect(initials("'17 Summer")).toBe('17S')
  })

  it('upper-cases the result', () => {
    expect(initials('late night')).toBe('LN')
  })

  it('ignores extra whitespace and punctuation-only words', () => {
    expect(initials('  Rock  &  Roll ')).toBe('RR')
  })

  it('keeps an emoji whole', () => {
    expect(initials('🔥 Hits')).toBe('🔥H')
  })

  it('falls back to ? for a blank name', () => {
    expect(initials('   ')).toBe('?')
  })
})
