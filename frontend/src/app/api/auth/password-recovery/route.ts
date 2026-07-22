import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPasswordRecoveryEmail } from '@/lib/mailer'
import { clientIpFromHeaders, rateLimit } from '@/lib/rate-limit'

const PASSWORD_RECOVERY_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://braveyoga.vercel.app'

function resetUrl(redirectTo: string) {
  const params = new URLSearchParams({ mode: 'reset' })
  if (redirectTo && redirectTo !== '/') params.set('redirect', redirectTo)
  return `${PASSWORD_RECOVERY_SITE_URL}/auth?${params.toString()}`
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  try {
    const ip = clientIpFromHeaders(req.headers)
    if (!rateLimit(`password-recovery-ip:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Забагато спроб. Спробуйте трохи пізніше.' }, { status: 429 })
    }

    const body = (await req.json().catch(() => ({}))) as { email?: string; redirectTo?: string }
    const email = String(body.email || '').trim().toLowerCase()
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Введіть коректний email.' }, { status: 400 })
    }
    if (!rateLimit(`password-recovery-email:${email}`, 3, 60 * 60_000)) {
      return NextResponse.json({ ok: true })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json({ error: 'Password recovery is not configured.' }, { status: 503 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const recoveryUrl = resetUrl(String(body.redirectTo || '/'))
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: recoveryUrl },
    })

    if (error || !data.properties?.action_link) {
      console.error('Password recovery link generation failed', error)
      return NextResponse.json({ ok: true })
    }

    await sendPasswordRecoveryEmail({ to: email, resetUrl: data.properties.action_link })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Password recovery email failed', err)
    return NextResponse.json({ error: 'Не вдалося надіслати лист для відновлення пароля.' }, { status: 500 })
  }
}
