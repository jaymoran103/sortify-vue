import { describe, it, expect } from 'vitest'
import {
  normalizeTitle,
  normalizeArtist,
  tokenSetOverlap,
  isUnmatchable,
  parseDuration,
} from '@/similarity/normalize'

describe('normalizeTitle', () => {
  it('strips a trailing remaster suffix, with or without a year', () => {
    expect(normalizeTitle('Respect - 2005 Remaster')).toBe('respect')
    expect(normalizeTitle('Respect - Remastered')).toBe('respect')
  })

  it('strips a trailing live suffix', () => {
    expect(normalizeTitle('Respect - Live')).toBe('respect')
  })

  it('strips a parenthesised feature credit', () => {
    expect(normalizeTitle('Sunny (feat. Connor Price)')).toBe('sunny')
  })

  it('strips a bracketed version marker', () => {
    expect(normalizeTitle('Dreams [2011 Remastered Version]')).toBe('dreams')
  })

  it('keeps a parenthetical that is part of the title', () => {
    expect(normalizeTitle("(Don't Fear) The Reaper")).toBe('dont fear the reaper')
  })

  it('keeps a hyphenated segment that is not a version marker', () => {
    expect(normalizeTitle('Hyphenated - Real Title')).toBe('hyphenated real title')
  })

  it('lowercases and strips punctuation', () => {
    expect(normalizeTitle("Don't Stop Me Now!")).toBe('dont stop me now')
  })

  it('collapses whitespace', () => {
    expect(normalizeTitle('  Too   Much   Space  ')).toBe('too much space')
  })

  it('reduces two releases of one recording to the same key', () => {
    expect(normalizeTitle('Respect - 2005 Remaster')).toBe(normalizeTitle('Respect'))
  })
})

describe('normalizeArtist', () => {
  it('keeps only the primary artist before a comma', () => {
    expect(normalizeArtist('Boney M., Connor Price')).toBe('boney m')
  })

  it('keeps only the primary artist before an ampersand', () => {
    expect(normalizeArtist('Simon & Garfunkel')).toBe('simon')
  })

  it('drops a feature credit', () => {
    expect(normalizeArtist('Drake feat. Rihanna')).toBe('drake')
  })

  it('drops a leading "the"', () => {
    expect(normalizeArtist('The Beatles')).toBe('beatles')
  })

  it('lowercases and strips punctuation', () => {
    expect(normalizeArtist('AC/DC')).toBe('ac dc')
  })

  it('matches a duo credit against the lead artist alone', () => {
    expect(normalizeArtist('Boney M., Connor Price')).toBe(normalizeArtist('Boney M.'))
  })
})

describe('tokenSetOverlap', () => {
  it('scores identical strings 1', () => {
    expect(tokenSetOverlap('respect', 'respect')).toBe(1)
  })

  it('scores a full containment 1, using the smaller set as denominator', () => {
    expect(tokenSetOverlap('respect', 'respect reprise')).toBe(1)
  })

  it('scores partial overlap between 0 and 1', () => {
    expect(tokenSetOverlap('one two three', 'one two four')).toBeCloseTo(2 / 3)
  })

  it('scores disjoint strings 0', () => {
    expect(tokenSetOverlap('alpha', 'beta')).toBe(0)
  })

  it('scores an empty string 0 rather than dividing by zero', () => {
    expect(tokenSetOverlap('', 'beta')).toBe(0)
  })
})

describe('isUnmatchable', () => {
  it('rejects the literal string undefined, which real exports contain', () => {
    expect(isUnmatchable('undefined', 'undefined')).toBe(true)
  })

  it('rejects a track whose title normalizes to nothing', () => {
    expect(isUnmatchable('!!!', 'Someone')).toBe(true)
  })

  it('accepts an ordinary track', () => {
    expect(isUnmatchable('Respect', 'Aretha Franklin')).toBe(false)
  })
})

describe('parseDuration', () => {
  it('parses the string form real exports use', () => {
    expect(parseDuration('192434')).toBe(192434)
  })

  it('passes a number through', () => {
    expect(parseDuration(192434)).toBe(192434)
  })

  it('rejects absent, empty and non-numeric values', () => {
    expect(parseDuration(undefined)).toBeNull()
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
  })

  it('rejects zero and negatives', () => {
    expect(parseDuration(0)).toBeNull()
    expect(parseDuration(-5)).toBeNull()
  })
})
