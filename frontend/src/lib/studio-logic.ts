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

async function buildClientsPayload(p: PrismaClient = prisma) {
  const studioClients = await p.studioClient.findMany()
  const bookings = await p.publicLessonBooking.findMany({
    include: { lesson: true },
    orderBy: { created_at: 'desc' },
  })

  return studioClients.map(sc => {
    const subs = (sc.subscriptions_json as unknown as ClientSub[]) || []
    const emailLower = sc.email.trim().toLowerCase()
    const myBookings = bookings.filter(
      b =>
        (b.client_user_id && b.client_user_id === sc.id) ||
        b.client_email.trim().toLowerCase() === emailLower
    )
    const clientBookings = myBookings.map(b => {
      const meta = (b.meta || {}) as ClientBookingMeta
      return {
        lessonId: b.lesson_id,
        className: b.lesson.class_name,
        date: b.created_at.toISOString(),
        trainerName: b.lesson.trainer_name,
        ...meta,
      }
    })
    return {
      id: sc.id,
      name: sc.name,
      email: sc.email,
      phone: sc.phone,
      password: '',
      subscriptions: subs,
      bookings: clientBookings,
    }
  })
}

async function buildSingleClientPayload(userId: string, p: PrismaClient = prisma) {
  const all = await buildClientsPayload(p)
  return all.filter(c => c.id === userId)
}

export async function getBootstrapData(opts: { isAdmin: boolean; userId: string | null }) {
  await seedLessonsIfEmpty()
  const cfg = await ensureStudioConfig()
  const lessons = await prisma.publicLesson.findMany({ orderBy: { start_timestamp: 'asc' } })
  const lessonJson = lessons.map(l => ({
    id: l.id,
    class_name: l.class_name,
    trainer_name: l.trainer_name,
    start_timestamp: l.start_timestamp.toISOString(),
    end_timestamp: l.end_timestamp.toISOString(),
    capacity: l.capacity,
    booked_count: l.booked_count,
    status: l.status,
  }))

  let clients: Awaited<ReturnType<typeof buildClientsPayload>>
  if (opts.isAdmin) {
    clients = await buildClientsPayload()
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
    },
  })
}

export async function deleteLessonById(id: string) {
  await prisma.publicLesson.delete({ where: { id } })
}

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

export async function putClientSubscriptionsRow(clientId: string, subscriptions: unknown[]) {
  await prisma.studioClient.update({
    where: { id: clientId },
    data: { subscriptions_json: subscriptions as Prisma.InputJsonValue },
  })
}

export async function postBookingRow(body: {
  lessonId: string
  client_email: string
  client_name: string
  client_user_id?: string | null
  meta?: Record<string, unknown> | null
}): Promise<string> {
  return prisma.$transaction(async tx => {
    const lesson = await tx.publicLesson.findUnique({ where: { id: body.lessonId } })
    if (!lesson) throw new Error('Lesson not found')
    if (lesson.booked_count >= lesson.capacity) throw new Error('Class is full')
    const booking = await tx.publicLessonBooking.create({
      data: {
        lesson_id: body.lessonId,
        client_email: body.client_email.trim(),
        client_name: (body.client_name || 'Гість').trim(),
        client_user_id: body.client_user_id || null,
        meta: body.meta ? (body.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
    await tx.publicLesson.update({
      where: { id: body.lessonId },
      data: { booked_count: { increment: 1 } },
    })
    return booking.id
  })
}

export async function postBookingWithSubscriptionRow(body: {
  lessonId: string
  client_user_id: string
  client_email: string
  client_name: string
  subscriptions: ClientSub[]
  meta?: Record<string, unknown> | null
}) {
  await prisma.$transaction(async tx => {
    const lesson = await tx.publicLesson.findUnique({ where: { id: body.lessonId } })
    if (!lesson) throw new Error('Lesson not found')
    if (lesson.booked_count >= lesson.capacity) throw new Error('Class is full')
    await tx.publicLessonBooking.create({
      data: {
        lesson_id: body.lessonId,
        client_email: body.client_email.trim(),
        client_name: (body.client_name || '').trim(),
        client_user_id: body.client_user_id,
        meta: body.meta ? (body.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
    await tx.publicLesson.update({
      where: { id: body.lessonId },
      data: { booked_count: { increment: 1 } },
    })
    await tx.studioClient.update({
      where: { id: body.client_user_id },
      data: { subscriptions_json: body.subscriptions as Prisma.InputJsonValue },
    })
  })
}

export async function cancelBookingRow(lessonId: string, email: string) {
  await prisma.$transaction(async tx => {
    const candidates = await tx.publicLessonBooking.findMany({ where: { lesson_id: lessonId } })
    const booking = candidates.find(
      b => b.client_email.trim().toLowerCase() === email.trim().toLowerCase()
    )
    if (!booking) throw new Error('Booking not found')
    const meta = (booking.meta || {}) as ClientBookingMeta & { subscription_id?: string }
    if (meta.subscription_id && booking.client_user_id) {
      const client = await tx.studioClient.findUnique({ where: { id: booking.client_user_id } })
      if (client) {
        const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).map(s =>
          s.id === meta.subscription_id
            ? { ...s, used_sessions: Math.max(0, (s.used_sessions || 0) - 1) }
            : s
        )
        await tx.studioClient.update({
          where: { id: client.id },
          data: { subscriptions_json: subs as Prisma.InputJsonValue },
        })
      }
    }
    const lessonRow = await tx.publicLesson.findUnique({ where: { id: lessonId } })
    await tx.publicLessonBooking.delete({ where: { id: booking.id } })
    await tx.publicLesson.update({
      where: { id: lessonId },
      data: { booked_count: Math.max(0, (lessonRow?.booked_count ?? 1) - 1) },
    })
  })
}

export async function getLessonForCancel(lessonId: string, email: string) {
  const lesson = await prisma.publicLesson.findUnique({ where: { id: lessonId } })
  if (!lesson) return null
  if (!email) {
    return {
      id: lesson.id,
      class_name: lesson.class_name,
      trainer_name: lesson.trainer_name,
      start_timestamp: lesson.start_timestamp.toISOString(),
      end_timestamp: lesson.end_timestamp.toISOString(),
      capacity: lesson.capacity,
      booked_count: lesson.booked_count,
      status: lesson.status,
      my_booking_email: '',
      my_booking_name: '',
    }
  }
  const list = await prisma.publicLessonBooking.findMany({ where: { lesson_id: lesson.id } })
  const b = list.find(x => x.client_email.trim().toLowerCase() === email.trim().toLowerCase())
  return {
    id: lesson.id,
    class_name: lesson.class_name,
    trainer_name: lesson.trainer_name,
    start_timestamp: lesson.start_timestamp.toISOString(),
    end_timestamp: lesson.end_timestamp.toISOString(),
    capacity: lesson.capacity,
    booked_count: lesson.booked_count,
    status: lesson.status,
    is_booked_by_me: !!b,
    my_booking_email: b?.client_email,
    my_booking_name: b?.client_name,
  }
}

export async function redeemPromoRow(body: { code: string; clientId: string; clientEmail: string }) {
  const cfg = await ensureStudioConfig()
  const promos = asPromoArray(cfg.promo_codes_json) as Array<{
    code: string
    used?: boolean
    plan_id: string
    plan_name: string
    sessions: number
    duration_days: number
    used_by?: string
  }>
  const upper = body.code.trim().toUpperCase()
  const promo = promos.find(p => p.code === upper)
  if (!promo) throw new Error('Invalid code')
  if (promo.used) throw new Error('Code already used')
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
  const client = await prisma.studioClient.findUnique({ where: { id: body.clientId } })
  if (!client) throw new Error('Client not found')
  const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).concat(newSub)
  const nextPromos = promos.map(p =>
    p.code === upper ? { ...p, used: true, used_by: body.clientEmail || client.email } : p
  )
  await prisma.$transaction([
    prisma.studioClient.update({
      where: { id: body.clientId },
      data: { subscriptions_json: subs as Prisma.InputJsonValue },
    }),
    prisma.studioConfig.update({
      where: { id: 1 },
      data: { promo_codes_json: nextPromos as Prisma.InputJsonValue },
    }),
  ])
}
