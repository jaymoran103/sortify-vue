/**
 * Up to two display initials for a generated cover.
 *
 * Input: a playlist or folder name. Output: one or two uppercase characters, or '' for a name
 * with no letters or digits. No side effects.
 *
 * Names are split on anything that is not a letter or digit, since exported names lean on
 * underscores, dashes and apostrophes. Words that start with a letter win, so
 * "2014_clock_radio" reads CR. A name of digits only keeps two of them, so "'18_" reads 18
 * rather than a stray apostrophe.
 */
export function initialsOf(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const lettered = words.filter((word) => /^\p{L}/u.test(word))
  if (lettered.length > 0) {
    return lettered
      .slice(0, 2)
      .map((word) => [...word][0]!.toUpperCase())
      .join('')
  }
  return words[0] ? [...words[0]].slice(0, 2).join('') : ''
}
