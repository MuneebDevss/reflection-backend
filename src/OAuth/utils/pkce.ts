import { createHash } from 'crypto'

/**
 * Verify PKCE: Claude always sends code_challenge_method=S256.
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export function verifyPkce(verifier: string, storedChallenge: string): boolean {
  const computed = createHash('sha256')
    .update(verifier)
    .digest('base64url')
  return computed === storedChallenge
}