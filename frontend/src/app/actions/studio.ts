'use server'

import { cookies, headers } from 'next/headers'
import {
  signBookingCancelToken,
  verifyAdminSessionToken,
  verifyBookingCancelToken,
} from '@/lib/admin-crypto'
import { sendBookingConfirmationEmail, sendBookingCancelledByClientEmail } from '@/lib/mailer'
import { clientIpFromHeaders, rateLimit } from '@/lib/rate-limit'
import { getSupabaseUser, getSupabaseUserId } from '@/lib/supabase/server-user'
import {
  getBootstrapData,
  updateStudioConfigPartial,
  createLesson,
  deleteLessonById,
  updateLessonById,
  upsertStudioClientRow,
  putClientSubscriptionsRow,
  postBookingRow,
  postBookingWithSubscriptionRow,
  cancelBookingByIdRow,
  cancelOwnedBookingRow,
  getLessonForCancelByToken,
  redeemPromoRow,
  ensureStudioClientForUser,
} from '@/lib/studio-logic'

const ADMIN_COOKIE = 'brave_admin'

async function readAdminCookie(): Promise<boolean> {
  const c = (await cookies()).get(ADMIN_COOKIE)?.value
  return verifyAdminSessionToken(c)
}

async function assertAdmin() {
  if (!(await readAdminCookie())) throw new Error('Unauthorized: admin session required')
}

async function requireUser() {
  const u = await getSupabaseUser()
  if (!u) throw new Error('Unauthorized')
  return u
}

async function rateLimitByIp(key: string, max: number, windowMs: number) {
  const ip = clientIpFromHeaders(await headers())
  if (!rateLimit(`${key}:${ip}`, max, windowMs)) {
    throw new Error('Too many requests. Try again shortly.')
  }
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

export async function updateLessonAction(id: string, data: Parameters<typeof updateLessonById>[1]) {
  await assertAdmin()
  await updateLessonById(id, data)
  return { ok: true as const }
}

/** Verified email is taken from the auth session — body.email is ignored to prevent email-hijack. */
export async function upsertStudioClientAction(body: { name: string; phone: string }) {
  const user = await requireUser()
  await upsertStudioClientRow({
    id: user.id,
    email: user.email,
    name: body.name,
    phone: body.phone,
  })
  return { ok: true as const }
}

export async function putClientSubscriptionsAction(subscriptions: unknown[]) {
  const user = await requireUser()
  await putClientSubscriptionsRow(user.id, subscriptions)
  return { ok: true as const }
}

/**
 * Authenticated single-visit booking. Identity is read from the Supabase session;
 * caller-supplied email/name/user_id are ignored. Server sends the confirmation email.
 */
export async function postBookingAction(body: { lessonId: string; meta?: Record<string, unknown> | null }) {
  const user = await requireUser()
  await rateLimitByIp('book', 10, 60_000)
  const sc = await ensureStudioClientForUser(user)
  const created = await postBookingRow({
    lessonId: body.lessonId,
    client_email: sc.email,
    client_name: sc.name,
    client_user_id: user.id,
    meta: body.meta ?? null,
  })
  await trySendBookingEmail({
    to: sc.email,
    clientName: sc.name || 'Гість',
    className: created.className,
    startTimestamp: created.startTimestamp,
    endTimestamp: created.endTimestamp,
    trainerName: created.trainerName,
    lessonId: body.lessonId,
    bookingId: created.bookingId,
  })
  return { ok: true as const, bookingId: created.bookingId }
}

export async function postBookingWithSubscriptionAction(body: {
  lessonId: string
  subscriptionId: string
  meta?: Record<string, unknown> | null
}) {
  const user = await requireUser()
  await rateLimitByIp('book', 10, 60_000)
  const sc = await ensureStudioClientForUser(user)
  const created = await postBookingWithSubscriptionRow({
    lessonId: body.lessonId,
    client_user_id: user.id,
    client_email: sc.email,
    client_name: sc.name,
    subscriptionId: body.subscriptionId,
    meta: body.meta ?? null,
  })
  await trySendBookingEmail({
    to: sc.email,
    clientName: sc.name || 'Гість',
    className: created.className,
    startTimestamp: created.startTimestamp,
    endTimestamp: created.endTimestamp,
    trainerName: created.trainerName,
    lessonId: body.lessonId,
    bookingId: created.bookingId,
  })
  return { ok: true as const, bookingId: created.bookingId }
}

export async function cancelBookingAction(args: {
  lessonId: string
  /** Signed cancel token from the confirmation email. When omitted, the caller must be the booking's owner. */
  token?: string
}) {
  let cancelled
  if (args.token) {
    const verified = verifyBookingCancelToken(args.token, args.lessonId)
    if (!verified) throw new Error('Invalid or expired cancel link')
    cancelled = await cancelBookingByIdRow(verified.bookingId)
  } else {
    const user = await requireUser()
    cancelled = await cancelOwnedBookingRow(args.lessonId, { userId: user.id, email: user.email })
  }
  const hoursLeft = (cancelled.startTimestamp.getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursLeft < 2) {
    // Already committed — reverse is unsafe; keep the cancellation. Surface a warning.
    console.warn('Cancellation processed within 2h window', { lessonId: args.lessonId })
  }
  try {
    await sendBookingCancelledByClientEmail({
      to: cancelled.email,
      clientName: cancelled.name || 'Гість',
      className: cancelled.className,
      startTimestamp: cancelled.startTimestamp,
      endTimestamp: cancelled.endTimestamp,
    })
  } catch (err) {
    console.error('Cancel email failed', err)
  }
  return { ok: true as const }
}

export async function fetchLessonForCancelAction(args: { lessonId: string; token: string }) {
  const verified = verifyBookingCancelToken(args.token, args.lessonId)
  if (!verified) throw new Error('Invalid or expired cancel link')
  const lesson = await getLessonForCancelByToken(verified.bookingId)
  if (!lesson) throw new Error('Not found')
  return { lesson }
}

export async function redeemPromoAction(body: { code: string }) {
  const user = await requireUser()
  await redeemPromoRow({ code: body.code, clientId: user.id, clientEmail: user.email })
  return { ok: true as const }
}

async function trySendBookingEmail(args: {
  to: string
  clientName: string
  className: string
  startTimestamp: Date
  endTimestamp: Date
  trainerName: string
  lessonId: string
  bookingId: string
}) {
  try {
    const cancelToken = signBookingCancelToken(args.bookingId, args.lessonId)
    await sendBookingConfirmationEmail({
      to: args.to,
      clientName: args.clientName,
      className: args.className,
      startTimestamp: args.startTimestamp,
      endTimestamp: args.endTimestamp,
      trainerName: args.trainerName,
      lessonId: args.lessonId,
      cancelToken,
    })
  } catch (err) {
    console.error('Booking email failed', err)
  }
}

