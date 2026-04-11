'use server'

import { cookies } from 'next/headers'
import nodemailer from 'nodemailer'
import { verifyAdminSessionToken } from '@/lib/admin-crypto'
import { getSupabaseUserId } from '@/lib/supabase/server-user'
import { publicSiteUrl } from '@/lib/site-url'
import {
  getBootstrapData,
  updateStudioConfigPartial,
  createLesson,
  deleteLessonById,
  upsertStudioClientRow,
  putClientSubscriptionsRow,
  postBookingRow,
  postBookingWithSubscriptionRow,
  cancelBookingRow,
  getLessonForCancel,
  redeemPromoRow,
  type ClientSub,
} from '@/lib/studio-logic'

const ADMIN_COOKIE = 'brave_admin'

async function readAdminCookie(): Promise<boolean> {
  const c = (await cookies()).get(ADMIN_COOKIE)?.value
  return verifyAdminSessionToken(c)
}

async function assertAdmin() {
  if (!(await readAdminCookie())) throw new Error('Unauthorized: admin session required')
}

function mailer() {
  const user = process.env.SMTP_EMAIL
  const pass = process.env.SMTP_PASSWORD
  if (!user || !pass) throw new Error('SMTP_EMAIL / SMTP_PASSWORD not configured')
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

export async function bootstrapStudioAction() {
  const isAdmin = await readAdminCookie()
  const userId = await getSupabaseUserId()
  return getBootstrapData({ isAdmin, userId })
}

export async function putStudioConfigAction(body: {
  trainers?: string[]
  classTypes?: string[]
  plans?: unknown[]
  promoCodes?: unknown[]
}) {
  await assertAdmin()
  await updateStudioConfigPartial(body)
  return { ok: true as const }
}

export async function createLessonAction(data: Parameters<typeof createLesson>[0]) {
  await assertAdmin()
  await createLesson(data)
  return { ok: true as const }
}

export async function deleteLessonAction(id: string) {
  await assertAdmin()
  await deleteLessonById(id)
  return { ok: true as const }
}

export async function upsertStudioClientAction(body: { id: string; email: string; name: string; phone: string }) {
  const uid = await getSupabaseUserId()
  if (!uid || uid !== body.id) throw new Error('Unauthorized')
  await upsertStudioClientRow(body)
  return { ok: true as const }
}

export async function putClientSubscriptionsAction(clientId: string, subscriptions: unknown[]) {
  const uid = await getSupabaseUserId()
  if (!uid || uid !== clientId) throw new Error('Unauthorized')
  await putClientSubscriptionsRow(clientId, subscriptions)
  return { ok: true as const }
}

export async function postBookingAction(body: Parameters<typeof postBookingRow>[0]) {
  if (body.client_user_id) {
    const uid = await getSupabaseUserId()
    if (!uid || uid !== body.client_user_id) throw new Error('Unauthorized')
  }
  const bookingId = await postBookingRow(body)
  return { ok: true as const, bookingId }
}

export async function postBookingWithSubscriptionAction(body: {
  lessonId: string
  client_user_id: string
  client_email: string
  client_name: string
  subscriptions: ClientSub[]
  meta?: Record<string, unknown> | null
}) {
  const uid = await getSupabaseUserId()
  if (!uid || uid !== body.client_user_id) throw new Error('Unauthorized')
  await postBookingWithSubscriptionRow(body)
  return { ok: true as const }
}

export async function cancelBookingAction(lessonId: string, email: string) {
  await cancelBookingRow(lessonId, email)
  return { ok: true as const }
}

export async function fetchLessonForCancelAction(lessonId: string, email: string) {
  const lesson = await getLessonForCancel(lessonId, email)
  if (!lesson) throw new Error('Not found')
  return { lesson }
}

export async function redeemPromoAction(body: { code: string; clientId: string; clientEmail: string }) {
  const uid = await getSupabaseUserId()
  if (!uid || uid !== body.clientId) throw new Error('Unauthorized')
  await redeemPromoRow(body)
  return { ok: true as const }
}

export async function sendBookingEmailAction(payload: {
  email: string
  clientName: string
  className: string
  startTime: string
  trainerName: string
  lessonId: string
}) {
  if (!payload.email) throw new Error('Email is required')
  const base = publicSiteUrl()
  const transporter = mailer()
  await transporter.sendMail({
    from: `"Brave! Yoga" <${process.env.SMTP_EMAIL}>`,
    to: payload.email,
    subject: `Підтвердження запису: ${payload.className}`,
    html: `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; background-color: #FAFAFA; padding: 40px 20px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 32px; font-weight: 900; margin: 0; color: #0F172A; letter-spacing: -1px;"><i style="font-family: 'Georgia', serif; color: #DDA343;">Brave!</i> Yoga</h1>
          <p style="color: #64748B; font-size: 14px; margin-top: 5px; text-transform: uppercase; letter-spacing: 2px;">Студія твого балансу</p>
        </div>
        <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #F1F5F9;">
          <h2 style="font-size: 20px; color: #0F172A; margin-top: 0;">Привіт, ${payload.clientName}! 👋</h2>
          <p style="font-size: 16px; color: #475569; line-height: 1.5;">Ми щасливі підтвердити ваш запис на тренування.</p>
          <div style="margin: 25px 0; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 20px; background-color: #F8FAFC;">
            <p style="margin: 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Заняття</p>
            <p style="margin: 4px 0 0 0; font-size: 18px; color: #0F172A; font-weight: 700;">${payload.className}</p>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Час</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; color: #0F172A; font-weight: 600;">${payload.startTime}</p>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Тренер</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; color: #0F172A; font-weight: 600;">${payload.trainerName}</p>
          </div>
          <p style="font-size: 14px; color: #64748B; line-height: 1.5; text-align: center; margin: 30px 0 15px 0;">Змінилися плани? Попередьте нас заздалегідь!</p>
          <div style="text-align: center;">
            <a href="${base}/cancel/${payload.lessonId}?email=${encodeURIComponent(payload.email)}" style="display: inline-block; padding: 14px 28px; background-color: #FEF2F2; color: #DC2626; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; border: 1px solid #FEE2E2;">Скасувати бронювання</a>
          </div>
        </div>
      </div>
    `,
  })
  return { ok: true as const }
}

export async function sendCancelBookingEmailAction(payload: {
  email: string
  clientName: string
  className: string
  startTime: string
}) {
  if (!payload.email) throw new Error('Email is required')
  const transporter = mailer()
  await transporter.sendMail({
    from: `"Brave! Yoga" <${process.env.SMTP_EMAIL}>`,
    to: payload.email,
    subject: `Скасування запису: ${payload.className}`,
    html: `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; background-color: #FAFAFA; padding: 40px 20px; border-radius: 16px;">
        <h2 style="text-align:center;">Запис скасовано</h2>
        <p style="text-align:center;">Привіт, ${payload.clientName}! Ваш запис скасовано.</p>
        <p style="text-align:center;"><b>${payload.className}</b><br/>${payload.startTime}</p>
      </div>
    `,
  })
  return { ok: true as const }
}
