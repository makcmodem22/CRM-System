import 'server-only'
/** Must run before `@prisma/client` so Prisma never initializes without `DATABASE_URL`. */
import '@/lib/env-bootstrap'
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
      single_visit_price: Math.max(0, Math.round(Number(data.single_visit_price ?? 200))),
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

export async function putClientSubscriptionsRow(clientId: string, subscriptions: unknown[]) {
  await prisma.studioClient.update({
    where: { id: clientId },
    data: { subscriptions_json: subscriptions as Prisma.InputJsonValue },
  })
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

    const meta = { ...(body.meta || {}), subscription_id: sub.id }
    const booking = await tx.publicLessonBooking.create({
      data: {
        lesson_id: body.lessonId,
        client_email: body.client_email.trim(),
        client_name: (body.client_name || '').trim(),
        client_user_id: body.client_user_id,
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

async function cancelBookingByIdInTx(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<CancelledBooking | null> {
  const booking = await tx.publicLessonBooking.findUnique({
    where: { id: bookingId },
    include: { lesson: true },
  })
  if (!booking) return null
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

/** Cancel by authenticated owner (uid or verified email match). */
export async function cancelOwnedBookingRow(
  lessonId: string,
  owner: { userId: string; email: string },
): Promise<CancelledBooking> {
  return prisma.$transaction(async tx => {
    const booking = await tx.publicLessonBooking.findFirst({
      where: {
        lesson_id: lessonId,
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

export async function autoCancelLowAttendanceLessons(windowHours = 2) {
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
export async function redeemPromoRow(body: { code: string; clientId: string; clientEmail: string }) {
  const upper = body.code.trim().toUpperCase()
  await prisma.$transaction(async tx => {
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
  })
}

/**
 * Webhook entry point: LiqPay told us this StudioPayment succeeded.
 * Phase 1 stub — flips the row to SUCCESS only. Phase 2 will additionally:
 *   - flip booking.status PENDING_PAYMENT -> CONFIRMED + send confirmation email
 *   - for purpose=PLAN, materialize the subscription on StudioClient
 * Idempotent: callers (and the route) check status === 'SUCCESS' first, so a duplicate
 * callback after the row is already SUCCESS is a no-op.
 */
export async function handleLiqpayPaidPayment(
  paymentId: string,
  args: { liqpayPaymentId: string | null },
) {
  await prisma.studioPayment.update({
    where: { id: paymentId },
    data: {
      status: 'SUCCESS',
      paid_at: new Date(),
      ...(args.liqpayPaymentId ? { liqpay_payment_id: args.liqpayPaymentId } : {}),
    },
  })
}

/**
 * Webhook entry point: LiqPay told us this StudioPayment failed/was reversed without us asking.
 * Phase 1 stub — flips the row to FAILED. Phase 2 will additionally release any associated
 * PENDING_PAYMENT booking (delete row, decrement booked_count) so the slot frees up immediately.
 */
export async function handleLiqpayFailedPayment(
  paymentId: string,
  args: { liqpayStatus: string },
) {
  await prisma.studioPayment.update({
    where: { id: paymentId },
    data: {
      status: 'FAILED',
      meta: { liqpay_status: args.liqpayStatus } as Prisma.InputJsonValue,
    },
  })
}
