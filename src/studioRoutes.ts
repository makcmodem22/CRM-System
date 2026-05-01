import { Express, Request, Response } from 'express'
import { PrismaClient, Prisma } from '@prisma/client'

const DEFAULT_PLANS = [
  { id: 'plan_4', name: 'Абонемент на 4 заняття', sessions: 4, price: 1000, duration_days: 30 },
  { id: 'plan_8', name: 'Абонемент на 8 занять', sessions: 8, price: 1800, duration_days: 30 },
  { id: 'plan_15', name: 'Абонемент на 15 занять', sessions: 15, price: 3000, duration_days: 30 },
]

const DEFAULT_TRAINERS = ['Alex Johnson', 'Sarah Smith', 'Mike Tyson', 'Олена Петренко', 'Дмитро Ковтун']
const DEFAULT_CLASS_TYPES = ['Yoga', 'Stretching', 'Crossfit Basics', 'Тайський бокс', 'Pilates 2.0']

async function ensureStudioConfig(prisma: PrismaClient) {
  const row = await prisma.studioConfig.findUnique({ where: { id: 1 } })
  if (row) return row
  return prisma.studioConfig.create({
    data: {
      id: 1,
      trainers_json: DEFAULT_TRAINERS as unknown as Prisma.InputJsonValue,
      class_types_json: DEFAULT_CLASS_TYPES as unknown as Prisma.InputJsonValue,
      plans_json: DEFAULT_PLANS as unknown as Prisma.InputJsonValue,
      promo_codes_json: [] as unknown as Prisma.InputJsonValue,
    },
  })
}

async function seedLessonsIfEmpty(prisma: PrismaClient) {
  const n = await prisma.publicLesson.count()
  if (n > 0) return
  const now = new Date()
  const mk = (h: number, m: number) => {
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d
  }
  await prisma.publicLesson.createMany({
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

type ClientSub = {
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

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function asPlanArray(v: unknown): typeof DEFAULT_PLANS {
  return Array.isArray(v) ? (v as typeof DEFAULT_PLANS) : DEFAULT_PLANS
}

function asPromoArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

async function buildClientsPayload(prisma: PrismaClient) {
  const studioClients = await prisma.studioClient.findMany()
  const bookings = await prisma.publicLessonBooking.findMany({
    include: { lesson: true },
    orderBy: { created_at: 'desc' },
  })

  return studioClients.map((sc) => {
    const subs = (sc.subscriptions_json as unknown as ClientSub[]) || []
    const emailLower = sc.email.trim().toLowerCase()
    const myBookings = bookings.filter(
      (b) =>
        (b.client_user_id && b.client_user_id === sc.id) ||
        b.client_email.trim().toLowerCase() === emailLower
    )
    const clientBookings = myBookings.map((b) => {
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

export function registerStudioRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/bootstrap', async (_req: Request, res: Response) => {
    try {
      await seedLessonsIfEmpty(prisma)
      const cfg = await ensureStudioConfig(prisma)
      const lessons = await prisma.publicLesson.findMany({ orderBy: { start_timestamp: 'asc' } })
      const clients = await buildClientsPayload(prisma)
      res.json({
        lessons: lessons.map((l) => ({
          id: l.id,
          class_name: l.class_name,
          trainer_name: l.trainer_name,
          start_timestamp: l.start_timestamp.toISOString(),
          end_timestamp: l.end_timestamp.toISOString(),
          capacity: l.capacity,
          booked_count: l.booked_count,
          status: l.status,
        })),
        clients,
        trainers: asStringArray(cfg.trainers_json),
        classTypes: asStringArray(cfg.class_types_json),
        plans: asPlanArray(cfg.plans_json),
        promoCodes: asPromoArray(cfg.promo_codes_json),
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: (e as Error).message })
    }
  })

  app.put('/api/studio-config', async (req: Request, res: Response) => {
    try {
      const { trainers, classTypes, plans, promoCodes } = req.body
      await ensureStudioConfig(prisma)
      await prisma.studioConfig.update({
        where: { id: 1 },
        data: {
          ...(trainers != null ? { trainers_json: trainers as Prisma.InputJsonValue } : {}),
          ...(classTypes != null ? { class_types_json: classTypes as Prisma.InputJsonValue } : {}),
          ...(plans != null ? { plans_json: plans as Prisma.InputJsonValue } : {}),
          ...(promoCodes != null ? { promo_codes_json: promoCodes as Prisma.InputJsonValue } : {}),
        },
      })
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: (e as Error).message })
    }
  })

  app.post('/api/lessons', async (req: Request, res: Response) => {
    try {
      const { id, class_name, trainer_name, start_timestamp, end_timestamp, capacity, status } = req.body
      if (!id || !class_name || !trainer_name || !start_timestamp || !end_timestamp) {
        res.status(400).json({ error: 'Missing fields' })
        return
      }
      await prisma.publicLesson.create({
        data: {
          id: String(id),
          class_name,
          trainer_name,
          start_timestamp: new Date(start_timestamp),
          end_timestamp: new Date(end_timestamp),
          capacity: Number(capacity) || 10,
          booked_count: 0,
          status: status || 'SCHEDULED',
        },
      })
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: (e as Error).message })
    }
  })

  app.delete('/api/lessons/:id', async (req: Request, res: Response) => {
    try {
      await prisma.publicLesson.delete({ where: { id: req.params.id } })
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: (e as Error).message })
    }
  })

  app.post('/api/clients/upsert', async (req: Request, res: Response) => {
    try {
      const { id, email, name, phone } = req.body
      if (!id || !email) {
        res.status(400).json({ error: 'id and email required' })
        return
      }
      await prisma.studioClient.upsert({
        where: { id: String(id) },
        create: {
          id: String(id),
          email: String(email),
          name: String(name || ''),
          phone: String(phone || ''),
          subscriptions_json: [],
        },
        update: {
          email: String(email),
          name: String(name || ''),
          phone: String(phone || ''),
        },
      })
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: (e as Error).message })
    }
  })

  app.put('/api/clients/:id/subscriptions', async (req: Request, res: Response) => {
    try {
      const subs = req.body.subscriptions
      if (!Array.isArray(subs)) {
        res.status(400).json({ error: 'subscriptions array required' })
        return
      }
      await prisma.studioClient.update({
        where: { id: req.params.id },
        data: { subscriptions_json: subs as Prisma.InputJsonValue },
      })
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: (e as Error).message })
    }
  })

  app.post('/api/bookings', async (req: Request, res: Response) => {
    try {
      const {
        lessonId,
        client_email,
        client_name,
        client_user_id,
        meta,
      } = req.body as {
        lessonId: string
        client_email: string
        client_name: string
        client_user_id?: string | null
        meta?: ClientBookingMeta | null
      }
      if (!lessonId || !client_email) {
        res.status(400).json({ error: 'lessonId and client_email required' })
        return
      }
      const result = await prisma.$transaction(async (tx) => {
        const lesson = await tx.publicLesson.findUnique({ where: { id: lessonId } })
        if (!lesson) throw new Error('Lesson not found')
        if (lesson.booked_count >= lesson.capacity) throw new Error('Class is full')
        const booking = await tx.publicLessonBooking.create({
          data: {
            lesson_id: lessonId,
            client_email: client_email.trim(),
            client_name: (client_name || 'Гість').trim(),
            client_user_id: client_user_id || null,
            meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        })
        await tx.publicLesson.update({
          where: { id: lessonId },
          data: { booked_count: { increment: 1 } },
        })
        return booking
      })
      res.json({ ok: true, bookingId: result.id })
    } catch (e) {
      console.error(e)
      res.status(400).json({ error: (e as Error).message })
    }
  })

  app.post('/api/bookings/with-subscription', async (req: Request, res: Response) => {
    try {
      const {
        lessonId,
        client_user_id,
        client_email,
        client_name,
        subscriptions,
        meta,
      } = req.body as {
        lessonId: string
        client_user_id: string
        client_email: string
        client_name: string
        subscriptions: ClientSub[]
        meta?: ClientBookingMeta | null
      }
      if (!lessonId || !client_user_id || !client_email || !Array.isArray(subscriptions)) {
        res.status(400).json({ error: 'Invalid body' })
        return
      }
      await prisma.$transaction(async (tx) => {
        const lesson = await tx.publicLesson.findUnique({ where: { id: lessonId } })
        if (!lesson) throw new Error('Lesson not found')
        if (lesson.booked_count >= lesson.capacity) throw new Error('Class is full')
        await tx.publicLessonBooking.create({
          data: {
            lesson_id: lessonId,
            client_email: client_email.trim(),
            client_name: (client_name || '').trim(),
            client_user_id,
            meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        })
        await tx.publicLesson.update({
          where: { id: lessonId },
          data: { booked_count: { increment: 1 } },
        })
        await tx.studioClient.update({
          where: { id: client_user_id },
          data: { subscriptions_json: subscriptions as Prisma.InputJsonValue },
        })
      })
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(400).json({ error: (e as Error).message })
    }
  })

  app.post('/api/bookings/cancel', async (req: Request, res: Response) => {
    try {
      const { lessonId, email } = req.body as { lessonId: string; email: string }
      if (!lessonId || !email) {
        res.status(400).json({ error: 'lessonId and email required' })
        return
      }
      await prisma.$transaction(async (tx) => {
        const candidates = await tx.publicLessonBooking.findMany({ where: { lesson_id: lessonId } })
        const booking = candidates.find(
          (b) => b.client_email.trim().toLowerCase() === email.trim().toLowerCase()
        )
        if (!booking) throw new Error('Booking not found')
        const meta = (booking.meta || {}) as ClientBookingMeta & { subscription_id?: string }
        if (meta.subscription_id && booking.client_user_id) {
          const client = await tx.studioClient.findUnique({ where: { id: booking.client_user_id } })
          if (client) {
            const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).map((s) =>
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
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(400).json({ error: (e as Error).message })
    }
  })

  app.get('/api/lessons/:id/for-cancel', async (req: Request, res: Response) => {
    try {
      const email = (req.query.email as string) || ''
      const lesson = await prisma.publicLesson.findUnique({ where: { id: req.params.id } })
      if (!lesson) {
        res.status(404).json({ error: 'Not found' })
        return
      }
      if (!email) {
        res.json({
          lesson: {
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
          },
        })
        return
      }
      const list = await prisma.publicLessonBooking.findMany({ where: { lesson_id: lesson.id } })
      const b = list.find((x) => x.client_email.trim().toLowerCase() === email.trim().toLowerCase())
      res.json({
        lesson: {
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
        },
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: (e as Error).message })
    }
  })

  app.post('/api/promo/redeem', async (req: Request, res: Response) => {
    try {
      const { code, clientId, clientEmail } = req.body as {
        code: string
        clientId: string
        clientEmail: string
      }
      if (!code || !clientId) {
        res.status(400).json({ error: 'code and clientId required' })
        return
      }
      const cfg = await ensureStudioConfig(prisma)
      const promos = asPromoArray(cfg.promo_codes_json) as Array<{
        code: string
        used?: boolean
        plan_id: string
        plan_name: string
        sessions: number
        duration_days: number
        used_by?: string
      }>
      const upper = code.trim().toUpperCase()
      const promo = promos.find((p) => p.code === upper)
      if (!promo) {
        res.status(400).json({ error: 'Invalid code' })
        return
      }
      if (promo.used) {
        res.status(400).json({ error: 'Code already used' })
        return
      }
      const plan = asPlanArray(cfg.plans_json).find((p) => p.id === promo.plan_id)
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
      const client = await prisma.studioClient.findUnique({ where: { id: clientId } })
      if (!client) {
        res.status(400).json({ error: 'Client not found' })
        return
      }
      const subs = ((client.subscriptions_json as unknown as ClientSub[]) || []).concat(newSub)
      const nextPromos = promos.map((p) =>
        p.code === upper ? { ...p, used: true, used_by: clientEmail || client.email } : p
      )
      await prisma.$transaction([
        prisma.studioClient.update({
          where: { id: clientId },
          data: { subscriptions_json: subs as Prisma.InputJsonValue },
        }),
        prisma.studioConfig.update({
          where: { id: 1 },
          data: { promo_codes_json: nextPromos as Prisma.InputJsonValue },
        }),
      ])
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: (e as Error).message })
    }
  })
}
