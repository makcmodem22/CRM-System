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
  createSingleVisitPayment,
  createPlanPurchasePayment,
  getPaymentStatusForOrder,
  postBookingWithSubscriptionRow,
  cancelBookingByIdRow,
  cancelOwnedBookingRow,
  getLessonForCancelByToken,
  redeemPromoRow,
  adminGrantCertificateToClient,
  ensureStudioClientForUser,
  listLessonSignups,
  type LessonSignup,
} from '@/lib/studio-logic'
import { buildCheckoutUrl } from '@/lib/liqpay'
import { publicSiteUrl } from '@/lib/site-url'

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

export async function listLessonSignupsAction(lessonId: string): Promise<LessonSignup[]> {
  await assertAdmin()
  return listLessonSignups(lessonId)
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

export type CheckoutResult =
  | { ok: true; orderId: string; checkoutUrl: string }
  | { ok: false; error: string }

/** True iff both LiqPay keys are configured; without them no checkout URL can be signed. */
function isLiqpayConfigured(): boolean {
  return !!process.env.LIQPAY_PUBLIC_KEY && !!process.env.LIQPAY_PRIVATE_KEY
}

/**
 * Begin a plan-purchase checkout. The caller supplies only `planId`; everything else (price,
 * sessions, expiry, plan name) is snapshotted server-side from `studio_config.plans_json` so a
 * hostile client cannot forge what they're paying for. Returns the LiqPay-hosted checkout URL.
 */
export async function purchasePlanAction(body: { planId: string }): Promise<CheckoutResult> {
  const user = await requireUser()
  await rateLimitByIp('purchase', 20, 60_000)
  if (!isLiqpayConfigured()) {
    console.error('purchasePlanAction: LIQPAY keys not set in environment')
    return { ok: false, error: 'Платіжна система тимчасово недоступна. Зверніться до адміністратора.' }
  }
  try {
    const sc = await ensureStudioClientForUser(user)
    const payment = await createPlanPurchasePayment({
      planId: body.planId,
      userId: user.id,
      email: sc.email,
    })
    const site = publicSiteUrl()
    const checkoutUrl = buildCheckoutUrl({
      orderId: payment.orderId,
      amount: payment.amount,
      description: `Купівля абонементу · ${BUSINESS_NAME}`,
      serverUrl: `${site}/api/liqpay/callback`,
      resultUrl: `${site}/payment/result?orderId=${encodeURIComponent(payment.orderId)}`,
    })
    return { ok: true, orderId: payment.orderId, checkoutUrl }
  } catch (err) {
    // Log the full stack server-side so `vercel logs` shows the digest + original message.
    // Surface a clean message to the client (Next.js would otherwise redact it in prod).
    console.error('purchasePlanAction failed', { userId: user.id, planId: body.planId, err })
    return { ok: false, error: errorToMessage(err, 'Не вдалося розпочати оплату абонементу.') }
  }
}

/**
 * Begin a single-visit checkout. Identity is read from the Supabase session; caller-supplied
 * email/name/user_id are ignored. The booking is created in PENDING_PAYMENT state so the slot
 * is held during checkout; if the user abandons, a sweeper releases it.
 */
export async function postBookingAction(body: { lessonId: string }): Promise<CheckoutResult> {
  const user = await requireUser()
  await rateLimitByIp('book', 10, 60_000)
  if (!isLiqpayConfigured()) {
    console.error('postBookingAction: LIQPAY keys not set in environment')
    return { ok: false, error: 'Платіжна система тимчасово недоступна. Зверніться до адміністратора.' }
  }
  try {
    const sc = await ensureStudioClientForUser(user)
    const payment = await createSingleVisitPayment({
      lessonId: body.lessonId,
      userId: user.id,
      email: sc.email,
      name: sc.name || 'Гість',
    })
    const site = publicSiteUrl()
    const checkoutUrl = buildCheckoutUrl({
      orderId: payment.orderId,
      amount: payment.amount,
      description: `Запис на заняття · ${BUSINESS_NAME}`,
      serverUrl: `${site}/api/liqpay/callback`,
      resultUrl: `${site}/payment/result?orderId=${encodeURIComponent(payment.orderId)}`,
    })
    return { ok: true, orderId: payment.orderId, checkoutUrl }
  } catch (err) {
    console.error('postBookingAction failed', { userId: user.id, lessonId: body.lessonId, err })
    return { ok: false, error: errorToMessage(err, 'Не вдалося розпочати запис.') }
  }
}

function errorToMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback
  const msg = err.message || ''
  // Prisma "table does not exist" — likely the booking-status migration was not applied.
  if (/does not exist/i.test(msg) && /studio_payment|public_lesson_booking/i.test(msg)) {
    return 'База даних не оновлена для платежів. Зверніться до адміністратора.'
  }
  return msg || fallback
}

/** Frontend polls this on the /payment/result page to know whether the callback has fired. */
export async function getPaymentStatusAction(body: { orderId: string }) {
  const user = await requireUser()
  await rateLimitByIp('payment-status', 60, 60_000)
  const status = await getPaymentStatusForOrder(body.orderId, user.id)
  if (!status) throw new Error('Платіж не знайдено')
  return status
}

const BUSINESS_NAME = 'Brave.Yoga'

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
  await rateLimitByIp('cancel', 20, 60_000)
  let cancelled
  if (args.token) {
    const verified = verifyBookingCancelToken(args.token, args.lessonId)
    if (!verified) throw new Error('Invalid or expired cancel link')
    // `cancelBookingByIdRow` enforces the 1-hour lockout inside its transaction.
    cancelled = await cancelBookingByIdRow(verified.bookingId)
  } else {
    const user = await requireUser()
    cancelled = await cancelOwnedBookingRow(args.lessonId, { userId: user.id, email: user.email })
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
  await rateLimitByIp('cancel-fetch', 30, 60_000)
  const verified = verifyBookingCancelToken(args.token, args.lessonId)
  if (!verified) throw new Error('Invalid or expired cancel link')
  const lesson = await getLessonForCancelByToken(verified.bookingId)
  if (!lesson) throw new Error('Not found')
  return { lesson }
}

export async function redeemPromoAction(body: { code: string }) {
  const user = await requireUser()
  const result = await redeemPromoRow({ code: body.code, clientId: user.id, clientEmail: user.email })
  return { ok: true as const, planName: result.planName }
}

/**
 * Admin-only: grant a gift subscription directly to a chosen client. The plan name,
 * session count, and duration are snapshotted server-side from the studio config; the
 * caller only supplies opaque IDs. Rate-limited per admin IP as a backstop against
 * accidental loops or a leaked admin cookie.
 */
export async function adminGrantCertificateAction(body: { clientId: string; planId: string }) {
  await assertAdmin()
  await rateLimitByIp('admin-grant-cert', 30, 60_000)
  if (typeof body?.clientId !== 'string' || typeof body?.planId !== 'string') {
    throw new Error('clientId and planId are required')
  }
  const result = await adminGrantCertificateToClient({
    clientId: body.clientId,
    planId: body.planId,
  })
  return { ok: true as const, planName: result.planName, subscriptionId: result.subscriptionId }
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
    const cancelToken = signBookingCancelToken(args.bookingId, args.lessonId, args.startTimestamp)
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

