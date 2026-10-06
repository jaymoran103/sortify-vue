import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESCRIPTION,
  MAX_DESCRIPTION_LENGTH,
  SORTIFY_SITE_URL,
  cleanDescription,
  resolveDescription,
} from '@/utils/playlistDescription'

describe('cleanDescription', () => {
  it('turns line breaks and runs of spaces into single spaces', () => {
    expect(cleanDescription('  late\n\nnight   drive \t')).toBe('late night drive')
  })
})

describe('resolveDescription', () => {
  const own = { description: 'Songs for the late drive home' }

  it('defaults to the Sortify link', () => {
    expect(DEFAULT_DESCRIPTION).toBe('https://jaymoran103.github.io/sortify-vue')
    expect(resolveDescription(own, { mode: 'site' })).toBe(DEFAULT_DESCRIPTION)
  })

  it("uses the playlist's own description in playlist mode", () => {
    expect(resolveDescription(own, { mode: 'playlist' })).toBe(own.description)
  })

  it('falls back to the Sortify link when the playlist has none', () => {
    expect(resolveDescription({}, { mode: 'playlist' })).toBe(DEFAULT_DESCRIPTION)
    expect(resolveDescription({ description: '  \n ' }, { mode: 'playlist' })).toBe(
      DEFAULT_DESCRIPTION,
    )
  })

  it('uses the custom text for every playlist in custom mode', () => {
    expect(resolveDescription(own, { mode: 'custom', customText: 'Sorted' })).toBe('Sorted')
    expect(resolveDescription(own, { mode: 'custom', customText: '' })).toBe(DEFAULT_DESCRIPTION)
  })

  it('appends the link when asked', () => {
    expect(resolveDescription(own, { mode: 'playlist', appendLink: true })).toBe(
      `${own.description} · ${SORTIFY_SITE_URL}`,
    )
  })

  it('caps the length, keeping the appended link whole', () => {
    const long = { description: 'a'.repeat(500) }
    expect(resolveDescription(long, { mode: 'playlist' })).toHaveLength(MAX_DESCRIPTION_LENGTH)

    const linked = resolveDescription(long, { mode: 'playlist', appendLink: true })
    expect(linked).toHaveLength(MAX_DESCRIPTION_LENGTH)
    expect(linked.endsWith(SORTIFY_SITE_URL)).toBe(true)
  })
})
