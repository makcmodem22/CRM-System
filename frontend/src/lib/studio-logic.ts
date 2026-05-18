import 'server-only'
/** Must run before `@prisma/client` so Prisma never initializes without `DATABASE_URL`. */
import '@/lib/env-bootstrap'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const DEFAULT_PLANS = [
  { id: 'plan_4', name: 'Абонемент на 4 заняття', sessions: 4, price: 1000, duration_days: 30 },
  { id: 'plan_8', name: 'Абонемент на 8 занять', sessions: 8, price: 1800, duration_days: 30 },
  { id: 'plan_15', name: 'Абонемент на 15 занять', sessions: 15, price: 3000, duration_days: 30 },
]

const DEFAULT_TRAINERS = ['Alex Johnson', 'Sarah Smith', 'Mike Tyson', 'Олена Петренко', 'Дмитро Ковтун']
const DEFAULT_CLASS_TYPES = ['Yoga', 'Stretching', 'Crossfit Basics', 'Тайський бокс', 'Pilates 2.0']

export type ClientSub = {
  id: string
  plan_id: string
  plan_name: string
  total_sessions: number
  used_sessions: number
  purchased_at: string
  expires_at: string
  source?: 'purchase' | 'promo'
}

type ClientBookingMeta = {
  subscription_kind?: 'paid' | 'gift'
  subscription_id?: string
  certificate_session_value?: number
  subscription_session_value?: number
}

export function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function asPlanArray(v: unknown): typeof DEFAULT_PLANS {
  return Array.isArray(v) ? (v as typeof DEFAULT_PLANS) : DEFAULT_PLANS
}

export function asPromoArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

export async function ensureStudioConfig(p: PrismaClient = prisma) {
  const row = await p.studioConfig.findUnique({ where: { id: 1 } })
  if (row) return row
  return p.studioConfig.create({
    data: {
      id: 1,
      trainers_json: DEFAULT_TRAINERS as unknown as Prisma.InputJsonValue,
      class_types_json: DEFAULT_CLASS_TYPES as unknown as Prisma.InputJsonValue,
      plans_json: DEFAULT_PLANS as unknown as Prisma.InputJsonValue,
      promo_codes_json: [] as unknown as Prisma.InputJsonValue,
    },
  })
}

const missingTablesHint =
  'The CRM tables are not in this database yet. From the `frontend` folder run: `npx prisma db push --schema=./prisma/schema.prisma` ' +
  'with `DATABASE_URL` and `DIRECT_URL` set (copy both from the repo root `.env` into `frontend/.env`, or export them in the shell). ' +
  'Use the direct Supabase host (`db.<project>.supabase.co:5432`) for `DIRECT_URL` so DDL can run.'

export async function seedLessonsIfEmpty(p: PrismaClient = prisma) {
  let n: number
  try {
    n = await p.publicLesson.count()
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2021') {
      throw new Error(missingTablesHint)
    }
    throw e
  }
  if (n > 0) return
  const now = new Date()
  const mk = (h: number, m: number) => {
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d
  }
  await p.publicLesson.createMany({
    data: [
      {
        id: '1',
        class_name: 'Stretching',
        trainer_name: 'Олена Петренко',
        start_timestamp: mk(9, 0),
        end_timestamp: mk(10, 0),
        capacity: 10,
        booked_count: 0,
        status: 'SCHEDULED',
      },
      {
        id: '2',
        class_name: 'Yoga',
        trainer_name: 'Alex Johnson',
        start_timestamp: mk(19, 0),
        end_timestamp: mk(20, 0),
        capacity: 15,
        booked_count: 0,
        status: 'SCHEDULED',
      },
    ],
  })
}

type ClientPayload = {
  id: string
  name: string
  email: string
  phone: string
  password: string
  subscriptions: ClientSub[]
  bookings: Array<{
    lessonId: string
    className: string
    date: string
    trainerName: string
  } & ClientBookingMeta>
}

function shapeBookings(
  bookings: Array<{
    lesson_id: string
    created_at: Date
    meta: unknown
    lesson: { class_name: string; trainer_name: string }
  }>,
) {
  return bookings.map(b => {
    const meta = (b.meta || {}) as ClientBookingMeta
    return {
      lessonId: b.lesson_id,
      className: b.lesson.class_name,
      date: b.created_at.toISOString(),
      trainerName: b.lesson.trainer_name,
      ...meta,
    }
  })
}

async function buildAdminClientsPayload(p: PrismaClient = prisma): Promise<ClientPayload[]> {
  const studioClients = await p.studioClient.findMany()
  const bookings = await p.publicLessonBooking.findMany({
    where: { status: 'CONFIRMED' },
    include: { lesson: true },
    orderBy: { created_at: 'desc' },
  })
  const byUid = new Map<string, typeof bookings>()
  const byEmail = new Map<string, typeof bookings>()
  for (const b of bookings) {
    if (b.client_user_id) {
      const list = byUid.get(b.client_user_id) ?? []
      list.push(b)
      byUid.set(b.client_user_id, list)
    }
    const e = b.client_email.trim().toLowerCase()
    const list = byEmail.get(e) ?? []
    list.push(b)
    byEmail.set(e, list)
  }
  return studioClients.map(sc => {
    const subs = (sc.subscriptions_json as unknown as ClientSub[]) || []
    const emailLower = sc.email.trim().toLowerCase()
    const merged = new Map<string, (typeof bookings)[number]>()
    for (const b of byUid.get(sc.id) ?? []) merged.set(b.id, b)
    for (const b of byEmail.get(emailLower) ?? []) merged.set(b.id, b)
    return {
      id: sc.id,
      name: sc.name,
      email: sc.email,
      phone: sc.phone,
      password: '',
      subscriptions: subs,
      bookings: shapeBookings([...merged.values()]),
    }
  })
}

async function buildSingleClientPayload(userId: string, p: PrismaClient = prisma): Promise<ClientPayload[]> {
  const sc = await p.studioClient.findUnique({ where: { id: userId } })
  if (!sc) return []
  const emailLower = sc.email.trim().toLowerCase()
  const myBookings = await p.publicLessonBooking.findMany({
    where: {
      status: 'CONFIRMED',
      OR: [
        { client_user_id: sc.id },
        { client_email: { equals: sc.email, mode: 'insensitive' } },
      ],
    },
    include: { lesson: true },
    orderBy: { created_at: 'desc' },
  })
  const subs = (sc.subscriptions_json as unknown as ClientSub[]) || []
  return [
    {
      id: sc.id,
      name: sc.name,
      email: sc.email,
      phone: sc.phone,
      password: '',
      subscriptions: subs,
      bookings: shapeBookings(
        myBookings.filter(b =>
          b.client_user_id === sc.id || b.client_email.trim().toLowerCase() === emailLower,
        ),
      ),
    },
  ]
}

export type LessonSignup = {
  bookingId: string
  lessonId: string
  client_user_id: string | null
  name: string
  email: string
  phone: string
  /** CONFIRMED = paid / subscription-redeemed. PENDING_PAYMENT = LiqPay checkout in progress, slot held. */
  status: 'CONFIRMED' | 'PENDING_PAYMENT'
  created_at: string
  subscription_kind?: 'paid' | 'gift'
  subscription_id?: string
}

/**
 * Admin-only. Returns every booking row that currently holds a slot — both CONFIRMED and
 * in-flight PENDING_PAYMENT bookings. Without including PENDING ones, the admin's signups
 * list would silently diverge from the lesson's `booked_count` (which counts held slots).
 */
export async function listLessonSignups(lessonId: string): Promise<LessonSignup[]> {
  const rows = await prisma.publicLessonBooking.findMany({
    where: {
      lesson_id: String(lessonId),
      status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
    },
    orderBy: { created_at: 'asc' },
  })
  const userIds = Array.from(new Set(rows.map(r => r.client_user_id).filter((v): v is string => !!v)))
  const emails = Array.from(new Set(rows.map(r => r.client_email.trim().toLowerCase())))
  const studioClients = await prisma.studioClient.findMany({
    where: { OR: [{ id: { in: userIds } }, { email: { in: emails, mode: 'insensitive' } }] },
  })
  const byId = new Map(studioClients.map(c => [c.id, c]))
  const byEmail = new Map(studioClients.map(c => [c.email.trim().toLowerCase(), c]))
  return rows.map(r => {
    const sc = (r.client_user_id ? byId.get(r.client_user_id) : null) ?? byEmail.get(r.client_email.trim().toLowerCase()) ?? null
    const meta = (r.meta || {}) as ClientBookingMeta
    return {
      bookingId: r.id,
      lessonId: r.lesson_id,
      client_user_id: r.client_user_id,
      name: sc?.name || r.client_name,
      email: sc?.email || r.client_email,
      phone: sc?.phone || '',
      status: (r.status === 'PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'CONFIRMED') as 'CONFIRMED' | 'PENDING_PAYMENT',
      created_at: r.created_at.toISOString(),
      subscription_kind: meta.subscription_kind,
      subscription_id: meta.subscription_id,
    }
  })
}

const LESSON_HISTORY_DAYS = 30
const LESSON_LOOKAHEAD_DAYS = 90

export async function getBootstrapData(opts: { isAdmin: boolean; userId: string | null }) {
  await seedLessonsIfEmpty()
  const cfg = await ensureStudioConfig()
  const now = Date.now()
  const lessons = await prisma.publicLesson.findMany({
    where: opts.isAdmin
      ? undefined
      : {
          start_timestamp: {
            gte: new Date(now - LESSON_HISTORY_DAYS * 24 * 60 * 60 * 1000),
            lte: new Date(now + LESSON_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000),
          },
        },
    orderBy: { start_timestamp: 'asc' },
  })
  const lessonJson = lessons.map(l => ({
    id: l.id,
    class_name: l.class_name,
    trainer_name: l.trainer_name,
    start_timestamp: l.start_timestamp.toISOString(),
    end_timestamp: l.end_timestamp.toISOString(),
    capacity: l.capacity,
    booked_count: l.booked_count,
    status: l.status,
    single_visit_price: l.single_visit_price,
  }))

  let clients: ClientPayload[]
  if (opts.isAdmin) {
    clients = await buildAdminClientsPayload()
  } else if (opts.userId) {
    clients = await buildSingleClientPayload(opts.userId)
  } else {
    clients = []
  }

  let promoCodes = asPromoArray(cfg.promo_codes_json)
  if (!opts.isAdmin) promoCodes = []

  return {
    lessons: lessonJson,
    clients,
    trainers: asStringArray(cfg.trainers_json),
    classTypes: asStringArray(cfg.class_types_json),
    plans: asPlanArray(cfg.plans_json),
    promoCodes,
  }
}

export async function updateStudioConfigPartial(body: {
  trainers?: string[]
  classTypes?: string[]
  plans?: unknown[]
  promoCodes?: unknown[]
}) {
  await ensureStudioConfig()
  await prisma.studioConfig.update({
    where: { id: 1 },
    data: {
      ...(body.trainers != null ? { trainers_json: body.trainers as Prisma.InputJsonValue } : {}),
      ...(body.classTypes != null ? { class_types_json: body.classTypes as Prisma.InputJsonValue } : {}),
      ...(body.plans != null ? { plans_json: body.plans as Prisma.InputJsonValue } : {}),
      ...(body.promoCodes != null ? { promo_codes_json: body.promoCodes as Prisma.InputJsonValue } : {}),
    },
  })
}

export async function createLesson(data: {
  id: string
  class_name: string
  trainer_name: string
  start_timestamp: string
  end_timestamp: string
  capacity: number
  status?: string
  single_visit_price?: number
}) {
  await prisma.publicLesson.create({
    data: {
      id: String(data.id),
      class_name: data.class_name,
      trainer_name: data.trainer_name,
      start_timestamp: new Date(data.start_timestamp),
      end_timestamp: new Date(data.end_timestamp),
      capacity: Number(data.capacity) || 10,
      booked_count: 0,
      status: data.status || 'SCHEDULED',
      single_visit_price: Math.max(0, Math.round(Number(data.single_visit_price ?? 300))),
    },
  })
}

/**
 * Refund subscription sessions for every booking on the lesson, then cascade-delete
 * the lesson row. Mirrors {@link autoCancelLowAttendanceLessons} so admin-driven
 * deletes don't silently burn paid subscription credits.
 */
export async function deleteLessonById(id: string) {
  await prisma.$transaction(async tx => {
    const bookings = await tx.publicLessonBooking.findMany({ where: { lesson_id: id } })
    for (const booking of bookings) {
      const meta = (booking.meta || {}) as ClientBookingMeta
      if (meta.subscription_id && booking.client_user_id) {
        const client = await tx.studioClient.findUnique({ where: { id: booking.client_user_id } })
        if (client) {
          const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).map(s =>
            s.id === meta.subscription_id
              ? { ...s, used_sessions: Math.max(0, (s.used_sessions || 0) - 1) }
              : s,
          )
          await tx.studioClient.update({
            where: { id: client.id },
            data: { subscriptions_json: subs as Prisma.InputJsonValue },
          })
        }
      }
    }
    await tx.publicLesson.delete({ where: { id } })
  })
}

export async function updateLessonById(
  id: string,
  data: {
    class_name: string
    trainer_name: string
    start_timestamp: string
    end_timestamp: string
    single_visit_price?: number
  },
) {
  await prisma.publicLesson.update({
    where: { id },
    data: {
      class_name: data.class_name,
      trainer_name: data.trainer_name,
      start_timestamp: new Date(data.start_timestamp),
      end_timestamp: new Date(data.end_timestamp),
      ...(data.single_visit_price != null
        ? { single_visit_price: Math.max(0, Math.round(Number(data.single_visit_price))) }
        : {}),
    },
  })
}

/** The verified email is read from the auth session at the action layer; never trust caller-supplied email. */
export async function upsertStudioClientRow(body: { id: string; email: string; name: string; phone: string }) {
  await prisma.studioClient.upsert({
    where: { id: String(body.id) },
    create: {
      id: String(body.id),
      email: String(body.email),
      name: String(body.name || ''),
      phone: String(body.phone || ''),
      subscriptions_json: [],
    },
    update: {
      email: String(body.email),
      name: String(body.name || ''),
      phone: String(body.phone || ''),
    },
  })
}

/**
 * Look up the studio_client row for an authenticated user, creating an empty
 * one keyed to the verified email if missing. Returns the row used as the
 * source of truth for booking identity.
 */
export async function ensureStudioClientForUser(user: { id: string; email: string }) {
  const existing = await prisma.studioClient.findUnique({ where: { id: user.id } })
  if (existing) {
    if (existing.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return prisma.studioClient.update({
        where: { id: user.id },
        data: { email: user.email },
      })
    }
    return existing
  }
  return prisma.studioClient.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email, name: '', phone: '', subscriptions_json: [] },
    update: { email: user.email },
  })
}

// ── Payment lifecycle (LiqPay) ──────────────────────────────────────────────

// 60 min covers LiqPay's 3DS / bank-callback window. Shorter values risk the sweeper
// failing a payment while the bank is still authorising it; longer values just hold the slot.
const PENDING_PAYMENT_TTL_MS = 60 * 60 * 1000

export type StudioPaymentPurpose = 'single_visit' | 'plan_purchase'

export type PaymentCreated = {
  paymentId: string
  orderId: string
  amount: number
  currency: string
}

/**
 * Atomically holds the slot via a PENDING_PAYMENT booking and creates a StudioPayment row
 * carrying the lesson's price snapshot. Caller turns the returned orderId/amount into a
 * LiqPay checkout URL. Re-uses the same conditional-update pattern as `postBookingRow` so
 * two concurrent checkouts can't oversell.
 */
export async function createSingleVisitPayment(args: {
  lessonId: string
  userId: string
  email: string
  name: string
}): Promise<PaymentCreated & { lessonStartTimestamp: Date }> {
  return prisma.$transaction(async tx => {
    const reserved = await tx.$executeRaw`
      UPDATE public_lesson
      SET booked_count = booked_count + 1
      WHERE id = ${args.lessonId}
        AND status = 'SCHEDULED'
        AND booked_count < capacity
    `
    if (reserved === 0) {
      const lesson = await tx.publicLesson.findUnique({ where: { id: args.lessonId } })
      if (!lesson) throw new Error('Lesson not found')
      if (lesson.status !== 'SCHEDULED') throw new Error('Class is not available for booking')
      throw new Error('Class is full')
    }
    const lesson = await tx.publicLesson.findUnique({ where: { id: args.lessonId } })
    if (!lesson) throw new Error('Lesson not found')
    // The booking is allowed up until the lesson actually starts. Cancellation has its own
    // 1-hour lockout (see CANCEL_LOCKOUT_MS in cancelBookingByIdInTx) — that rule is about
    // refunds, not about whether you can sign up.
    if (lesson.start_timestamp.getTime() <= Date.now()) {
      throw new Error('Заняття вже почалося')
    }
    const amount = Math.max(0, Math.round(lesson.single_visit_price))
    if (amount <= 0) throw new Error('Lesson is misconfigured: missing single_visit_price')

    const booking = await tx.publicLessonBooking.create({
      data: {
        lesson_id: args.lessonId,
        client_user_id: args.userId,
        client_email: args.email.trim(),
        client_name: (args.name || 'Гість').trim(),
        status: 'PENDING_PAYMENT',
      },
    })

    const orderId = `bv-${randomUUID()}`
    const payment = await tx.studioPayment.create({
      data: {
        id: randomUUID(),
        liqpay_order_id: orderId,
        amount,
        currency: 'UAH',
        status: 'CREATED',
        purpose: 'single_visit',
        booking_id: booking.id,
        client_user_id: args.userId,
        client_email: args.email,
        meta: {
          lesson_id: args.lessonId,
          lesson_start: lesson.start_timestamp.toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
    return {
      paymentId: payment.id,
      orderId: payment.liqpay_order_id,
      amount: payment.amount,
      currency: payment.currency,
      lessonStartTimestamp: lesson.start_timestamp,
    }
  })
}

/**
 * Snapshot the plan as it exists right now (price/sessions/duration) into the payment row.
 * On successful callback we grant the subscription from that snapshot, so an admin who later
 * edits or removes the plan cannot change what the user actually pays for.
 */
export async function createPlanPurchasePayment(args: {
  planId: string
  userId: string
  email: string
}): Promise<PaymentCreated> {
  const cfg = await ensureStudioConfig()
  const plans = asPlanArray(cfg.plans_json)
  const plan = plans.find(p => p.id === args.planId)
  if (!plan) throw new Error('Unknown plan')
  const amount = Math.max(0, Math.round(Number(plan.price) || 0))
  if (amount <= 0) throw new Error('Plan has invalid price')
  const snapshot = {
    id: plan.id,
    name: String(plan.name || plan.id),
    sessions: Math.max(1, Math.round(Number(plan.sessions) || 0)),
    price: amount,
    duration_days: Math.max(1, Math.round(Number(plan.duration_days) || 0)),
  }
  const orderId = `pp-${randomUUID()}`
  const payment = await prisma.studioPayment.create({
    data: {
      id: randomUUID(),
      liqpay_order_id: orderId,
      amount,
      currency: 'UAH',
      status: 'CREATED',
      purpose: 'plan_purchase',
      client_user_id: args.userId,
      client_email: args.email,
      plan_id: plan.id,
      plan_snapshot: snapshot as Prisma.InputJsonValue,
    },
  })
  return {
    paymentId: payment.id,
    orderId: payment.liqpay_order_id,
    amount: payment.amount,
    currency: payment.currency,
  }
}

export type PaidEmailContext = {
  to: string
  clientName: string
  className: string
  trainerName: string
  startTimestamp: Date
  endTimestamp: Date
  lessonId: string
  bookingId: string
}

/**
 * Mark a payment SUCCESS and run side effects. Idempotent — if the payment is already SUCCESS,
 * just returns the existing context. The action layer is responsible for sending the
 * confirmation email outside the DB transaction so an email failure doesn't roll back state.
 */
export async function handleLiqpayPaidPayment(
  paymentId: string,
  ctx: { liqpayPaymentId?: string | null },
): Promise<{
  purpose: StudioPaymentPurpose
  alreadyProcessed: boolean
  bookingId?: string
  subscriptionId?: string
  emailContext?: PaidEmailContext
}> {
  return prisma.$transaction(async tx => {
    // Atomic CREATED → SUCCESS state transition. Only one concurrent caller wins this
    // updateMany; the rest see count=0 and return alreadyProcessed. This is what makes the
    // function safe under LiqPay's retry behaviour where two webhook deliveries can race.
    const paidAt = new Date()
    const flipped = await tx.studioPayment.updateMany({
      where: { id: paymentId, status: 'CREATED' },
      data: {
        status: 'SUCCESS',
        paid_at: paidAt,
        ...(ctx.liqpayPaymentId ? { liqpay_payment_id: ctx.liqpayPaymentId } : {}),
      },
    })

    if (flipped.count === 0) {
      const existing = await tx.studioPayment.findUnique({ where: { id: paymentId } })
      if (!existing) throw new Error('Payment not found')
      if (existing.status === 'SUCCESS') {
        return {
          purpose: existing.purpose as StudioPaymentPurpose,
          alreadyProcessed: true,
          bookingId: existing.booking_id ?? undefined,
        }
      }
      throw new Error(`Cannot mark ${existing.status} payment as paid`)
    }

    const payment = await tx.studioPayment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new Error('Payment vanished after state flip')

    if (payment.purpose === 'single_visit') {
      if (!payment.booking_id) throw new Error('single_visit payment missing booking_id')
      const booking = await tx.publicLessonBooking.findUnique({
        where: { id: payment.booking_id },
        include: { lesson: true },
      })
      if (!booking) throw new Error('Booking not found')
      if (booking.status === 'PENDING_PAYMENT') {
        await tx.publicLessonBooking.update({
          where: { id: booking.id },
          data: { status: 'CONFIRMED' },
        })
      }
      return {
        purpose: 'single_visit',
        alreadyProcessed: false,
        bookingId: booking.id,
        emailContext: {
          to: booking.client_email,
          clientName: booking.client_name || 'Гість',
          className: booking.lesson.class_name,
          trainerName: booking.lesson.trainer_name,
          startTimestamp: booking.lesson.start_timestamp,
          endTimestamp: booking.lesson.end_timestamp,
          lessonId: booking.lesson.id,
          bookingId: booking.id,
        },
      }
    }

    if (payment.purpose === 'plan_purchase') {
      if (!payment.client_user_id) throw new Error('plan_purchase payment missing client_user_id')
      const snap = (payment.plan_snapshot || {}) as {
        id?: string; name?: string; sessions?: number; duration_days?: number; price?: number
      }
      const total = Math.max(1, Math.round(Number(snap.sessions) || 0))
      const days = Math.max(1, Math.round(Number(snap.duration_days) || 0))
      const now = new Date()
      const newSub: ClientSub = {
        id: randomUUID(),
        plan_id: String(snap.id || payment.plan_id || 'unknown'),
        plan_name: String(snap.name || snap.id || 'Plan'),
        total_sessions: total,
        used_sessions: 0,
        purchased_at: now.toISOString(),
        expires_at: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
        source: 'purchase',
      }
      const client = await tx.studioClient.findUnique({ where: { id: payment.client_user_id } })
      if (!client) throw new Error('Client not found')
      const existing = (client.subscriptions_json as unknown as ClientSub[]) || []
      await tx.studioClient.update({
        where: { id: payment.client_user_id },
        data: { subscriptions_json: [...existing, newSub] as Prisma.InputJsonValue },
      })
      const baseMeta = (payment.meta && typeof payment.meta === 'object' ? payment.meta as Record<string, unknown> : {})
      await tx.studioPayment.update({
        where: { id: payment.id },
        data: { meta: { ...baseMeta, subscription_id: newSub.id } as Prisma.InputJsonValue },
      })
      return { purpose: 'plan_purchase', alreadyProcessed: false, subscriptionId: newSub.id }
    }

    throw new Error(`Unknown payment purpose: ${payment.purpose}`)
  })
}

/**
 * Mark payment FAILED and release the held slot (single_visit) by deleting the
 * PENDING_PAYMENT booking and decrementing booked_count. Idempotent.
 */
export async function handleLiqpayFailedPayment(
  paymentId: string,
  ctx: { liqpayStatus?: string },
): Promise<void> {
  await prisma.$transaction(async tx => {
    const payment = await tx.studioPayment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new Error('Payment not found')
    if (payment.status === 'FAILED') return
    if (payment.status === 'SUCCESS' || payment.status === 'REFUNDED') {
      throw new Error(`Cannot mark ${payment.status} payment as failed`)
    }

    if (payment.purpose === 'single_visit' && payment.booking_id) {
      const booking = await tx.publicLessonBooking.findUnique({ where: { id: payment.booking_id } })
      if (booking && booking.status === 'PENDING_PAYMENT') {
        await tx.publicLessonBooking.delete({ where: { id: booking.id } })
        await tx.publicLesson.updateMany({
          where: { id: booking.lesson_id, booked_count: { gt: 0 } },
          data: { booked_count: { decrement: 1 } },
        })
      }
    }
    const baseMeta = (payment.meta && typeof payment.meta === 'object' ? payment.meta as Record<string, unknown> : {})
    await tx.studioPayment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        meta: { ...baseMeta, liqpay_status: ctx.liqpayStatus } as Prisma.InputJsonValue,
      },
    })
  })
}

/** For the post-checkout result page: scoped to caller's own payments. Returns null if not theirs. */
export async function getPaymentStatusForOrder(
  orderId: string,
  callerUserId: string,
): Promise<{
  status: 'CREATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
  purpose: StudioPaymentPurpose
  amount: number
  bookingId: string | null
} | null> {
  const p = await prisma.studioPayment.findUnique({ where: { liqpay_order_id: orderId } })
  if (!p) return null
  if (p.client_user_id && p.client_user_id !== callerUserId) return null
  return {
    status: p.status as 'CREATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED',
    purpose: p.purpose as StudioPaymentPurpose,
    amount: p.amount,
    bookingId: p.booking_id,
  }
}

/** Release PENDING_PAYMENT bookings whose payments are older than the TTL (LiqPay checkout window). */
export async function sweepStalePendingPayments(ttlMs = PENDING_PAYMENT_TTL_MS): Promise<{
  releasedSlots: number
  orphansFailed: number
}> {
  const cutoff = new Date(Date.now() - ttlMs)
  let releasedSlots = 0
  let orphansFailed = 0
  const stale = await prisma.studioPayment.findMany({
    where: {
      status: 'CREATED',
      purpose: 'single_visit',
      created_at: { lt: cutoff },
      booking_id: { not: null },
    },
  })
  for (const p of stale) {
    try {
      await handleLiqpayFailedPayment(p.id, { liqpayStatus: 'timeout' })
      releasedSlots++
    } catch (err) {
      console.error('sweepStalePendingPayments: visit failed', { paymentId: p.id, err })
    }
  }
  const orphans = await prisma.studioPayment.findMany({
    where: { status: 'CREATED', purpose: 'plan_purchase', created_at: { lt: cutoff } },
  })
  for (const p of orphans) {
    try {
      await prisma.studioPayment.update({ where: { id: p.id }, data: { status: 'FAILED' } })
      orphansFailed++
    } catch (err) {
      console.error('sweepStalePendingPayments: plan failed', { paymentId: p.id, err })
    }
  }
  return { releasedSlots, orphansFailed }
}

export type CreatedBooking = {
  bookingId: string
  className: string
  trainerName: string
  startTimestamp: Date
  endTimestamp: Date
}

/**
 * Atomic capacity-and-status check via conditional updateMany. Capacity is bounded
 * by a raw SQL fragment so two concurrent bookings can't both pass the gate.
 */
export async function postBookingRow(body: {
  lessonId: string
  client_email: string
  client_name: string
  client_user_id?: string | null
  meta?: Record<string, unknown> | null
}): Promise<CreatedBooking> {
  return prisma.$transaction(async tx => {
    const reserved = await tx.$executeRaw`
      UPDATE public_lesson
      SET booked_count = booked_count + 1
      WHERE id = ${body.lessonId}
        AND status = 'SCHEDULED'
        AND booked_count < capacity
    `
    if (reserved === 0) {
      const lesson = await tx.publicLesson.findUnique({ where: { id: body.lessonId } })
      if (!lesson) throw new Error('Lesson not found')
      if (lesson.status !== 'SCHEDULED') throw new Error('Class is not available for booking')
      throw new Error('Class is full')
    }
    const lesson = await tx.publicLesson.findUnique({ where: { id: body.lessonId } })
    if (!lesson) throw new Error('Lesson not found')
    const booking = await tx.publicLessonBooking.create({
      data: {
        lesson_id: body.lessonId,
        client_email: body.client_email.trim(),
        client_name: (body.client_name || 'Гість').trim(),
        client_user_id: body.client_user_id || null,
        status: 'CONFIRMED',
        meta: body.meta ? (body.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
    return {
      bookingId: booking.id,
      className: lesson.class_name,
      trainerName: lesson.trainer_name,
      startTimestamp: lesson.start_timestamp,
      endTimestamp: lesson.end_timestamp,
    }
  })
}

/**
 * Books a lesson and decrements the named subscription's remaining sessions atomically.
 * Server-side it re-reads the client's subscriptions and validates the chosen subscription
 * has remaining sessions, so a stale or hostile client can't grant itself extra sessions.
 */
export async function postBookingWithSubscriptionRow(body: {
  lessonId: string
  client_user_id: string
  client_email: string
  client_name: string
  subscriptionId: string
  meta?: Record<string, unknown> | null
}): Promise<CreatedBooking> {
  return prisma.$transaction(async tx => {
    const client = await tx.studioClient.findUnique({ where: { id: body.client_user_id } })
    if (!client) throw new Error('Client not found')
    const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).slice()
    const idx = subs.findIndex(s => s.id === body.subscriptionId)
    if (idx === -1) throw new Error('Subscription not found')
    const sub = subs[idx]
    if (sub.used_sessions >= sub.total_sessions) throw new Error('No remaining sessions')
    if (Date.parse(sub.expires_at) <= Date.now()) throw new Error('Subscription expired')

    const reserved = await tx.$executeRaw`
      UPDATE public_lesson
      SET booked_count = booked_count + 1
      WHERE id = ${body.lessonId}
        AND status = 'SCHEDULED'
        AND booked_count < capacity
    `
    if (reserved === 0) {
      const lesson = await tx.publicLesson.findUnique({ where: { id: body.lessonId } })
      if (!lesson) throw new Error('Lesson not found')
      if (lesson.status !== 'SCHEDULED') throw new Error('Class is not available for booking')
      throw new Error('Class is full')
    }
    const lesson = await tx.publicLesson.findUnique({ where: { id: body.lessonId } })
    if (!lesson) throw new Error('Lesson not found')
    if (lesson.start_timestamp.getTime() <= Date.now()) {
      throw new Error('Заняття вже почалося')
    }

    const meta = { ...(body.meta || {}), subscription_id: sub.id }
    const booking = await tx.publicLessonBooking.create({
      data: {
        lesson_id: body.lessonId,
        client_email: body.client_email.trim(),
        client_name: (body.client_name || '').trim(),
        client_user_id: body.client_user_id,
        status: 'CONFIRMED',
        meta: meta as Prisma.InputJsonValue,
      },
    })

    subs[idx] = { ...sub, used_sessions: sub.used_sessions + 1 }
    await tx.studioClient.update({
      where: { id: body.client_user_id },
      data: { subscriptions_json: subs as Prisma.InputJsonValue },
    })

    return {
      bookingId: booking.id,
      className: lesson.class_name,
      trainerName: lesson.trainer_name,
      startTimestamp: lesson.start_timestamp,
      endTimestamp: lesson.end_timestamp,
    }
  })
}

export type CancelledBooking = {
  className: string
  trainerName: string
  startTimestamp: Date
  endTimestamp: Date
  email: string
  name: string
}

/** Thrown when a user/token cancel is attempted within the 1-hour pre-lesson lockout. */
export class CancelTooLateError extends Error {
  constructor() {
    super('Скасування неможливе менш ніж за 1 годину до початку заняття.')
    this.name = 'CancelTooLateError'
  }
}

const CANCEL_LOCKOUT_MS = 1 * 60 * 60 * 1000

async function cancelBookingByIdInTx(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<CancelledBooking | null> {
  const booking = await tx.publicLessonBooking.findUnique({
    where: { id: bookingId },
    include: { lesson: true },
  })
  if (!booking) return null
  // Defense-in-depth: the client UI also blocks <2h cancels, but the server must enforce the
  // rule so anyone calling the action directly (or holding a cancel-link) can't bypass it.
  if (booking.lesson.start_timestamp.getTime() - Date.now() < CANCEL_LOCKOUT_MS) {
    throw new CancelTooLateError()
  }
  const meta = (booking.meta || {}) as ClientBookingMeta
  if (meta.subscription_id && booking.client_user_id) {
    const client = await tx.studioClient.findUnique({ where: { id: booking.client_user_id } })
    if (client) {
      const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).map(s =>
        s.id === meta.subscription_id
          ? { ...s, used_sessions: Math.max(0, (s.used_sessions || 0) - 1) }
          : s,
      )
      await tx.studioClient.update({
        where: { id: client.id },
        data: { subscriptions_json: subs as Prisma.InputJsonValue },
      })
    }
  }
  await tx.publicLessonBooking.delete({ where: { id: booking.id } })
  await tx.publicLesson.updateMany({
    where: { id: booking.lesson_id, booked_count: { gt: 0 } },
    data: { booked_count: { decrement: 1 } },
  })
  return {
    className: booking.lesson.class_name,
    trainerName: booking.lesson.trainer_name,
    startTimestamp: booking.lesson.start_timestamp,
    endTimestamp: booking.lesson.end_timestamp,
    email: booking.client_email,
    name: booking.client_name,
  }
}

/** Cancel by signed token (token IS the auth). */
export async function cancelBookingByIdRow(bookingId: string): Promise<CancelledBooking> {
  const result = await prisma.$transaction(tx => cancelBookingByIdInTx(tx, bookingId))
  if (!result) throw new Error('Booking not found')
  return result
}

/** Cancel by authenticated owner (uid or verified email match). Skips PENDING_PAYMENT rows. */
export async function cancelOwnedBookingRow(
  lessonId: string,
  owner: { userId: string; email: string },
): Promise<CancelledBooking> {
  return prisma.$transaction(async tx => {
    const booking = await tx.publicLessonBooking.findFirst({
      where: {
        lesson_id: lessonId,
        status: 'CONFIRMED',
        OR: [
          { client_user_id: owner.userId },
          { client_email: { equals: owner.email, mode: 'insensitive' } },
        ],
      },
    })
    if (!booking) throw new Error('Booking not found')
    const result = await cancelBookingByIdInTx(tx, booking.id)
    if (!result) throw new Error('Booking not found')
    return result
  })
}

export async function autoCancelLowAttendanceLessons(windowHours = 1) {
  const now = new Date()
  const cutoff = new Date(now.getTime() + windowHours * 60 * 60 * 1000)
  const candidates = await prisma.publicLesson.findMany({
    where: {
      status: 'SCHEDULED',
      start_timestamp: { gt: now, lte: cutoff },
      booked_count: { lte: 1 },
    },
  })

  const cancelled: Array<{
    id: string
    class_name: string
    trainer_name: string
    start_timestamp: Date
    notifyEmails: Array<{ email: string; name: string }>
  }> = []

  for (const lesson of candidates) {
    try {
      const notifyEmails: Array<{ email: string; name: string }> = []
      const committed = await prisma.$transaction(async tx => {
        const flipped = await tx.publicLesson.updateMany({
          where: { id: lesson.id, status: 'SCHEDULED', booked_count: { lte: 1 } },
          data: { status: 'CANCELLED', booked_count: 0 },
        })
        if (flipped.count === 0) return false

        const bookings = await tx.publicLessonBooking.findMany({ where: { lesson_id: lesson.id } })
        for (const booking of bookings) {
          const meta = (booking.meta || {}) as ClientBookingMeta
          if (meta.subscription_id && booking.client_user_id) {
            const client = await tx.studioClient.findUnique({ where: { id: booking.client_user_id } })
            if (client) {
              const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).map(s =>
                s.id === meta.subscription_id
                  ? { ...s, used_sessions: Math.max(0, (s.used_sessions || 0) - 1) }
                  : s,
              )
              await tx.studioClient.update({
                where: { id: client.id },
                data: { subscriptions_json: subs as Prisma.InputJsonValue },
              })
            }
          }
          await tx.publicLessonBooking.delete({ where: { id: booking.id } })
          notifyEmails.push({ email: booking.client_email, name: booking.client_name })
        }
        return true
      })
      if (committed) {
        cancelled.push({
          id: lesson.id,
          class_name: lesson.class_name,
          trainer_name: lesson.trainer_name,
          start_timestamp: lesson.start_timestamp,
          notifyEmails,
        })
      }
    } catch (err) {
      console.error('Auto-cancel: lesson failed, continuing', { lessonId: lesson.id, err })
    }
  }

  return cancelled
}

/** Look up lesson + booking via signed token (no email exposure). */
export async function getLessonForCancelByToken(bookingId: string) {
  const booking = await prisma.publicLessonBooking.findUnique({
    where: { id: bookingId },
    include: { lesson: true },
  })
  if (!booking) return null
  const lesson = booking.lesson
  return {
    id: lesson.id,
    class_name: lesson.class_name,
    trainer_name: lesson.trainer_name,
    start_timestamp: lesson.start_timestamp.toISOString(),
    end_timestamp: lesson.end_timestamp.toISOString(),
    capacity: lesson.capacity,
    booked_count: lesson.booked_count,
    status: lesson.status,
    single_visit_price: lesson.single_visit_price,
    is_booked_by_me: true,
    my_booking_email: booking.client_email,
    my_booking_name: booking.client_name,
  }
}

/**
 * Atomic promo redemption. Locks studio_config row 1 with FOR UPDATE so two
 * concurrent redemptions of the same code can't both pass the used-check.
 */
export async function redeemPromoRow(body: { code: string; clientId: string; clientEmail: string }): Promise<{ planName: string }> {
  const upper = body.code.trim().toUpperCase()
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM studio_config WHERE id = 1 FOR UPDATE`
    const cfg = await tx.studioConfig.findUnique({ where: { id: 1 } })
    if (!cfg) throw new Error('Studio config missing')
    const promos = asPromoArray(cfg.promo_codes_json) as Array<{
      code: string
      used?: boolean
      plan_id: string
      plan_name: string
      sessions: number
      duration_days: number
      used_by?: string
    }>
    const promo = promos.find(p => p.code === upper)
    if (!promo) throw new Error('Invalid code')
    if (promo.used) throw new Error('Code already used')

    const client = await tx.studioClient.findUnique({ where: { id: body.clientId } })
    if (!client) throw new Error('Client not found')

    const now = new Date()
    const addDays = (d: Date, days: number) => {
      const x = new Date(d)
      x.setDate(x.getDate() + days)
      return x
    }
    const newSub: ClientSub = {
      id: Math.random().toString(36).slice(2, 11),
      plan_id: promo.plan_id,
      plan_name: `${promo.plan_name} (Подарунок)`,
      total_sessions: promo.sessions,
      used_sessions: 0,
      purchased_at: now.toISOString(),
      expires_at: addDays(now, promo.duration_days).toISOString(),
      source: 'promo',
    }

    const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).concat(newSub)
    const nextPromos = promos.map(p =>
      p.code === upper ? { ...p, used: true, used_by: body.clientEmail || client.email } : p,
    )

    await tx.studioClient.update({
      where: { id: body.clientId },
      data: { subscriptions_json: subs as Prisma.InputJsonValue },
    })
    await tx.studioConfig.update({
      where: { id: 1 },
      data: { promo_codes_json: nextPromos as Prisma.InputJsonValue },
    })

    return { planName: promo.plan_name }
  })
}
