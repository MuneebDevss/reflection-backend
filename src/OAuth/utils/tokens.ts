import { createHash, randomBytes } from 'crypto'

/** Cryptographically random opaque token */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** SHA-256 hex hash — never store raw tokens */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}