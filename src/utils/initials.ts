/**
 * Up to two initials for a name, for labels too narrow to hold the name itself.
 *
 * Input: any display name. Two or more words give the first letter of the first two
 * ("Road Trip Mix" → "RT"). One word gives its first two letters ("Chill" → "CH").
 * Letters are upper-cased. A blank name gives "?". Splits by code point, so an emoji
 * stays whole instead of breaking into half a surrogate pair.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters =
    words.length === 1
      ? Array.from(words[0]!).slice(0, 2)
      : words.slice(0, 2).map((w) => Array.from(w)[0]!)
  return letters.join('').toUpperCase()
}
