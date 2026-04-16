import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, generateCodeChallenge } from '@/spotify/pkce'

describe('generateCodeVerifier', () => {
  it('returns a string of the default length (64)', () => {
    const v = generateCodeVerifier()
    expect(v).toHaveLength(64)
  })

  it('accepts a custom length', () => {
    const v = generateCodeVerifier(43)
    expect(v).toHaveLength(43)
  })

  it('only contains alphanumeric characters', () => {
    const v = generateCodeVerifier()
    expect(v).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('returns a different value on each call', () => {
    const a = generateCodeVerifier()
    const b = generateCodeVerifier()
    expect(a).not.toBe(b)
  })
})

describe('generateCodeChallenge', () => {
  it('returns a non-empty base64url string for a given verifier', async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    expect(challenge.length).toBeGreaterThan(0)
    // base64url must not contain +, /, or =
    expect(challenge).not.toMatch(/[+/=]/)
  })

  it('returns a deterministic value for the same verifier', async () => {
    const verifier = 'test-verifier-string-abc123'
    const c1 = await generateCodeChallenge(verifier)
    const c2 = await generateCodeChallenge(verifier)
    expect(c1).toBe(c2)
  })

  it('returns different values for different verifiers', async () => {
    const c1 = await generateCodeChallenge('verifier-one')
    const c2 = await generateCodeChallenge('verifier-two')
    expect(c1).not.toBe(c2)
  })
})
