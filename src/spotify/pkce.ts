// Generates a cryptographically random alphanumeric string of the given length.
// Length must be between 43 and 128 per PKCE spec; default is 64.
export function generateCodeVerifier(length = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc: string, x: number) => acc + possible[x % possible.length], '')
}

// Produces the PKCE code challenge from a verifier string.
// SHA-256 hashes the verifier then returns the result as a base64url-encoded string.
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hashed = await window.crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
