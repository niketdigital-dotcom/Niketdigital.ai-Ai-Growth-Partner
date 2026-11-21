// Server-only AES-256-GCM encryption for OAuth access/refresh tokens.
// NEVER import from frontend code. NEVER log plaintext tokens.
// Key: TOKEN_ENCRYPTION_KEY (or META_TOKEN_ENCRYPTION_KEY), server env only.
// Generate: openssl rand -hex 32  (64 hex chars = 32 bytes)
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto'
export class ConfigError extends Error {}
function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.META_TOKEN_ENCRYPTION_KEY || ''
  if (!raw) throw new ConfigError('TOKEN_ENCRYPTION_KEY is missing on the server.')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  try { const b = Buffer.from(raw, 'base64'); if (b.length === 32) return b } catch { /* fall through */ }
  throw new ConfigError('TOKEN_ENCRYPTION_KEY is invalid: it must be 32 bytes, as 64 hex characters (openssl rand -hex 32) or base64 of 32 bytes.')
}
export function encryptToken(plaintext: string): string {
  const key = getKey(); const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
}
export function decryptToken(stored: string): string {
  const key = getKey(); const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Stored token format is invalid.')
  const [ivHex, tagHex, dataHex] = parts
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
}
export function hashState(state: string): string { return createHash('sha256').update(state).digest('hex') }
