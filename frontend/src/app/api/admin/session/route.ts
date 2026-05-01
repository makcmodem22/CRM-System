import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { signAdminSessionToken, verifyAdminSessionToken } from '@/lib/admin-crypto'

const COOKIE = 'brave_admin'

export async function GET() {
  const token = (await cookies()).get(COOKIE)?.value
  return NextResponse.json({ loggedIn: verifyAdminSessionToken(token) })
}

export async function POST(req: Request) {
  try {
    const sessionSecret = process.env.ADMIN_SESSION_SECRET
    if (!sessionSecret || sessionSecret.length < 16) {
      return NextResponse.json(
        {
          error:
            'Set ADMIN_SESSION_SECRET in frontend/.env (at least 16 characters), then restart `npm run dev`.',
        },
        { status: 503 },
      )
    }
    const { password } = (await req.json()) as { password?: string }
    const expected = process.env.ADMIN_DASHBOARD_PASSWORD
    if (!expected || password !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = signAdminSessionToken()
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600,
      path: '/',
    })
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
