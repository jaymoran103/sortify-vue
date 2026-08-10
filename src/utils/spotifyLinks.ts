/**
 * Open a Spotify URI in the desktop app, falling back to the web player.
 *
 * Input: a `spotify:track:<id>` or `spotify:playlist:<id>` URI.
 * Side effects: navigates the current window to the URI, which hands off to the desktop app
 * when it is installed, then opens the web player in a new tab if the handoff appears not to
 * have happened. Unrecognised formats log a warning and do nothing. Never throws.
 *
 * The fallback signal is indirect, and worth understanding before changing it: if the desktop
 * app takes focus, this tab is backgrounded and its timers get throttled past the 1500ms
 * threshold, so the elapsed-time check fails and no tab is opened. If nothing handled the URI
 * the page keeps focus, the timer fires on schedule, and the web player opens. Throttling
 * rules differ across browsers, so this is a heuristic rather than a measurement — ported
 * as-is from the vanilla implementation. A direct `document.hidden` check is the alternative
 * if a spurious second tab ever shows up in practice.
 */
export function openSpotifyURI(uri: string): void {
  let webURL = 'https://open.spotify.com/'

  if (uri.includes('spotify:playlist:')) {
    webURL += `playlist/${uri.split(':').pop()}`
  } else if (uri.includes('spotify:track:')) {
    webURL += `track/${uri.split(':').pop()}`
  } else {
    console.warn('[openSpotifyURI] Unrecognised URI format:', uri)
    return
  }

  window.location.href = uri

  const start = Date.now()
  setTimeout(() => {
    if (Date.now() - start < 1500) {
      window.open(webURL, '_blank')
    }
  }, 1400)
}

/**
 * Write a value to the system clipboard.
 *
 * Input: the string to copy. Side effect: writes to the clipboard. Resolves either way —
 * a rejection (permission denied, insecure context) is logged and swallowed rather than
 * thrown, so callers need no error handling.
 *
 * Known limitation: failure is silent from the user's point of view. There is no toast
 * primitive in the app yet; recorded in BACKLOG.md.
 */
export async function copyToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
  } catch (err) {
    console.error('[copyToClipboard] Failed:', err)
  }
}
