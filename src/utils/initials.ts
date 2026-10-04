/**
 * Initials for a name, for labels too narrow to hold the name itself.
 *
 * Input: any display name. Every word gives one initial, and numbers are kept whole, since
 * they are often what tells two playlists apart ("recency 12 months" → "R12M",
 * "Spacebar2" → "S2", "'17 Summer" → "17S"). Leading punctuation is skipped. Letters are
 * upper-cased. A blank name gives "?". The result is not length-capped: the caller clips it
 * to whatever fits. Splits by code point, so an emoji stays whole.
 */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^\p{P}+/u, ''))
    .filter(Boolean)
    .map((word) => {
      const leadingNumber = word.match(/^\p{Nd}+/u)
      if (leadingNumber) return leadingNumber[0]
      const first = Array.from(word)[0]!
      const laterNumbers = word.slice(first.length).match(/\p{Nd}+/gu) ?? []
      return first + laterNumbers.join('')
    })
  return parts.length ? parts.join('').toUpperCase() : '?'
}
