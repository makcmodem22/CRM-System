import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

/** Constant-time string equality. Returns false on length mismatch without leaking timing. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Audience claim — purpose binding to prevent cross-token reuse. Booking-cancel tokens go to
 * end users via email and are HMAC-signed with the same secret as the admin session cookie;
 * without an audience check, a planted cancel token would satisfy the admin verifier (both
 * have an `exp` field). The verifier on each side enforces its expected audience.
 */
const TOKEN_AUDIENCE_ADMIN = 'admin'
const TOKEN_AUDIENCE_BOOKING_CANCEL = 'booking-cancel'

export function signAdminSessionToken(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET must be set (min 16 chars) for admin dashboard')
  }
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600
  const payload = Buffer.from(JSON.stringify({ aud: TOKEN_AUDIENCE_ADMIN, exp, v: 2 })).toString('base64url')
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
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      aud?: unknown
      b?: unknown
      l?: unknown
      s?: unknown
      exp?: unknown
    }
    // Reject any payload that carries booking-cancel fields. This is the defence-in-depth
    // that closes the cross-purpose hole even for legacy cancel tokens that pre-date the
    // `aud` claim.
    if (decoded.b != null || decoded.l != null || decoded.s != null) return false
    // New tokens carry `aud: 'admin'`. Legacy admin tokens (issued before this fix) had no
    // aud field — accept those too so existing admin sessions don't all log out on deploy,
    // but reject any payload that explicitly declares a different audience.
    if (decoded.aud != null && decoded.aud !== TOKEN_AUDIENCE_ADMIN) return false
    return typeof decoded.exp === 'number' && decoded.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

/**
 * Sign a per-booking cancel token. The token IS the auth — anyone holding it can view/cancel that
 * booking, so the TTL is capped tightly: min(72h, until lesson-start + 1h fudge factor).
 * `startTimestamp` is embedded in the signed payload so the token cannot outlive its lesson.
 */
export function signBookingCancelToken(bookingId: string, lessonId: string, startTimestamp: Date | number): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET must be set (min 16 chars)')
  }
  const startMs = typeof startTimestamp === 'number' ? startTimestamp : startTimestamp.getTime()
  const nowSec = Math.floor(Date.now() / 1000)
  const startSec = Math.floor(startMs / 1000)
  // TTL = at least 60s, at most 72h, and never past 1h after lesson start.
  const ttlSec = Math.max(60, Math.min(72 * 3600, startSec - nowSec + 3600))
  const exp = nowSec + ttlSec
  const payload = Buffer.from(
    JSON.stringify({ aud: TOKEN_AUDIENCE_BOOKING_CANCEL, b: bookingId, l: lessonId, s: startSec, exp, v: 3 }),
  ).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyBookingCancelToken(
  token: string | undefined,
  expectLessonId: string,
): { bookingId: string; startTimestamp?: number } | null {
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
      aud?: unknown
      b?: string
      l?: string
      s?: number
      exp?: number
      v?: number
    }
    // Accept new (aud=booking-cancel) and legacy (no aud) tokens. Reject any payload that
    // declares a different audience, e.g. an admin cookie pasted into the cancel link.
    if (decoded.aud != null && decoded.aud !== TOKEN_AUDIENCE_BOOKING_CANCEL) return null
    if (!decoded.b || !decoded.l) return null
    if (decoded.l !== expectLessonId) return null
    if (typeof decoded.exp !== 'number' || decoded.exp <= Math.floor(Date.now() / 1000)) return null
    const startTimestamp = typeof decoded.s === 'number' ? decoded.s * 1000 : undefined
    return { bookingId: decoded.b, startTimestamp }
  } catch {
    return null
  }
}
