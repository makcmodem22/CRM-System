import 'server-only'
import nodemailer from 'nodemailer'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { escapeHtml } from '@/lib/html-escape'
import { publicSiteUrl } from '@/lib/site-url'

let cachedTransporter: nodemailer.Transporter | null = null

function transporter() {
  if (cachedTransporter) return cachedTransporter
  const user = process.env.SMTP_EMAIL
  const pass = process.env.SMTP_PASSWORD
  if (!user || !pass) throw new Error('SMTP_EMAIL / SMTP_PASSWORD not configured')
  cachedTransporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  return cachedTransporter
}

function fromHeader() {
  return `"Brave! Yoga" <${process.env.SMTP_EMAIL}>`
}

function fmtTime(t: Date) {
  return format(t, 'd MMMM, HH:mm', { locale: uk })
}

export async function sendBookingConfirmationEmail(args: {
  to: string
  clientName: string
  className: string
  startTimestamp: Date
  trainerName: string
  lessonId: string
  cancelToken: string
}) {
  const base = publicSiteUrl()
  const startTime = fmtTime(args.startTimestamp)
  const cancelUrl = `${base}/cancel/${encodeURIComponent(args.lessonId)}?token=${encodeURIComponent(args.cancelToken)}`
  await transporter().sendMail({
    from: fromHeader(),
    to: args.to,
    subject: `Підтвердження запису: ${args.className}`,
    html: `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; background-color: #FAFAFA; padding: 40px 20px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 32px; font-weight: 900; margin: 0; color: #0F172A; letter-spacing: -1px;"><i style="font-family: 'Georgia', serif; color: #DDA343;">Brave!</i> Yoga</h1>
          <p style="color: #64748B; font-size: 14px; margin-top: 5px; text-transform: uppercase; letter-spacing: 2px;">Студія твого балансу</p>
        </div>
        <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #F1F5F9;">
          <h2 style="font-size: 20px; color: #0F172A; margin-top: 0;">Привіт, ${escapeHtml(args.clientName)}! 👋</h2>
          <p style="font-size: 16px; color: #475569; line-height: 1.5;">Ми щасливі підтвердити ваш запис на тренування.</p>
          <div style="margin: 25px 0; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 20px; background-color: #F8FAFC;">
            <p style="margin: 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Заняття</p>
            <p style="margin: 4px 0 0 0; font-size: 18px; color: #0F172A; font-weight: 700;">${escapeHtml(args.className)}</p>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Час</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; color: #0F172A; font-weight: 600;">${escapeHtml(startTime)}</p>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Тренер</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; color: #0F172A; font-weight: 600;">${escapeHtml(args.trainerName)}</p>
          </div>
          <p style="font-size: 14px; color: #64748B; line-height: 1.5; text-align: center; margin: 30px 0 15px 0;">Змінилися плани? Попередьте нас заздалегідь!</p>
          <div style="text-align: center;">
            <a href="${cancelUrl}" style="display: inline-block; padding: 14px 28px; background-color: #FEF2F2; color: #DC2626; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; border: 1px solid #FEE2E2;">Скасувати бронювання</a>
          </div>
        </div>
      </div>
    `,
  })
}

export async function sendBookingCancelledByClientEmail(args: {
  to: string
  clientName: string
  className: string
  startTimestamp: Date
}) {
  const startTime = fmtTime(args.startTimestamp)
  await transporter().sendMail({
    from: fromHeader(),
    to: args.to,
    subject: `Скасування запису: ${args.className}`,
    html: `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; background-color: #FAFAFA; padding: 40px 20px; border-radius: 16px;">
        <h2 style="text-align:center;">Запис скасовано</h2>
        <p style="text-align:center;">Привіт, ${escapeHtml(args.clientName)}! Ваш запис скасовано.</p>
        <p style="text-align:center;"><b>${escapeHtml(args.className)}</b><br/>${escapeHtml(startTime)}</p>
      </div>
    `,
  })
}
