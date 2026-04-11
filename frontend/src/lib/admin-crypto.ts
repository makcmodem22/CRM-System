import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

export function signAdminSessionToken(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET must be set (min 16 chars) for admin dashboard')
  }
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600
  const payload = Buffer.from(JSON.stringify({ exp, v: 1 })).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payload, sig] = parts
  try {
    const expected = createHmac('sha256', secret).update(payload).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number }
    return typeof exp === 'number' && exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}
