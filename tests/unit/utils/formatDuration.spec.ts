import { describe, it, expect } from 'vitest'
import { formatDuration } from '@/utils/formatDuration'

describe('formatDuration', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatDuration(289640)).toBe('4:50')
    expect(formatDuration(5000)).toBe('0:05')
  })

  it('adds hours past sixty minutes', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05')
  })

  it('gives an empty string for a missing or invalid length', () => {
    expect(formatDuration(undefined)).toBe('')
    expect(formatDuration(-1)).toBe('')
    expect(formatDuration(Number.NaN)).toBe('')
  })
})
