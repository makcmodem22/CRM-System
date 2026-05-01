import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

/** Constant-time string equality. Returns false on length mismatch without leaking timing. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

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

/** Sign a per-booking cancel token. The token IS the auth — anyone holding it can view/cancel that booking. */
export function signBookingCancelToken(bookingId: string, lessonId: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET must be set (min 16 chars)')
  }
  const exp = Math.floor(Date.now() / 1000) + 90 * 24 * 3600
  const payload = Buffer.from(JSON.stringify({ b: bookingId, l: lessonId, exp, v: 1 })).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyBookingCancelToken(
  token: string | undefined,
  expectLessonId: string,
): { bookingId: string } | null {
  if (!token) return null
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  try {
    const expected = createHmac('sha256', secret).update(payload).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      b?: string
      l?: string
      exp?: number
    }
    if (!decoded.b || !decoded.l) return null
    if (decoded.l !== expectLessonId) return null
    if (typeof decoded.exp !== 'number' || decoded.exp <= Math.floor(Date.now() / 1000)) return null
    return { bookingId: decoded.b }
  } catch {
    return null
  }
}
