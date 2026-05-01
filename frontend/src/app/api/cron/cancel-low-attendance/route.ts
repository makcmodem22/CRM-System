import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { constantTimeEqual } from '@/lib/admin-crypto'
import { escapeHtml } from '@/lib/html-escape'
import { autoCancelLowAttendanceLessons } from '@/lib/studio-logic'

export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  return constantTimeEqual(header, `Bearer ${secret}`)
}

async function sendCancellationEmail(to: string, name: string, className: string, startTimestamp: Date) {
  const user = process.env.SMTP_EMAIL
  const pass = process.env.SMTP_PASSWORD
  if (!user || !pass) return
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  const startTime = format(startTimestamp, 'd MMMM, HH:mm', { locale: uk })
  await transporter.sendMail({
    from: `"Brave! Yoga" <${user}>`,
    to,
    subject: `Заняття скасовано: ${className}`,
    html: `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; background-color: #FAFAFA; padding: 40px 20px; border-radius: 16px;">
        <h2 style="text-align:center;">Заняття скасовано</h2>
        <p style="text-align:center;">Привіт, ${escapeHtml(name || 'Гість')}! На жаль, заняття скасовано через недостатню кількість учасників.</p>
        <p style="text-align:center;"><b>${escapeHtml(className)}</b><br/>${escapeHtml(startTime)}</p>
        <p style="text-align:center; color:#64748B;">Сесію повернуто на ваш абонемент (якщо застосовно).</p>
      </div>
    `,
  })
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const cancelled = await autoCancelLowAttendanceLessons(2)
    let emailsSent = 0
    for (const lesson of cancelled) {
      for (const recipient of lesson.notifyEmails) {
        try {
          await sendCancellationEmail(recipient.email, recipient.name, lesson.class_name, lesson.start_timestamp)
          emailsSent++
        } catch (err) {
          console.error('Auto-cancel email failed', { lessonId: lesson.id, email: recipient.email, err })
        }
      }
    }
    return NextResponse.json({
      ok: true,
      cancelledCount: cancelled.length,
      emailsSent,
      lessons: cancelled.map(l => ({ id: l.id, class_name: l.class_name, start_timestamp: l.start_timestamp })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('Auto-cancel failed', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
