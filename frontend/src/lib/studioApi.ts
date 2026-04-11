'use client'

import {
  bootstrapStudioAction,
  putStudioConfigAction,
  createLessonAction,
  deleteLessonAction,
  upsertStudioClientAction,
  putClientSubscriptionsAction,
  postBookingAction,
  postBookingWithSubscriptionAction,
  cancelBookingAction,
  fetchLessonForCancelAction,
  redeemPromoAction,
  sendBookingEmailAction,
  sendCancelBookingEmailAction,
} from '@/app/actions/studio'

export type BootstrapPayload = {
  lessons: Array<{
    id: string
    class_name: string
    trainer_name: string
    start_timestamp: string
    end_timestamp: string
    capacity: number
    booked_count: number
    status: string
  }>
  clients: Array<{
    id: string
    name: string
    email: string
    phone: string
    password: string
    subscriptions: unknown[]
    bookings: unknown[]
  }>
  trainers: string[]
  classTypes: string[]
  plans: Array<{ id: string; name: string; sessions: number; price: number; duration_days: number }>
  promoCodes: unknown[]
}

export async function fetchBootstrap(): Promise<BootstrapPayload> {
  return bootstrapStudioAction() as Promise<BootstrapPayload>
}

export async function putStudioConfig(body: {
  trainers?: string[]
  classTypes?: string[]
  plans?: unknown[]
  promoCodes?: unknown[]
}) {
  return putStudioConfigAction(body)
}

export async function createLessonOnServer(lesson: {
  id: string
  class_name: string
  trainer_name: string
  start_timestamp: string
  end_timestamp: string
  capacity: number
  status?: string
}) {
  return createLessonAction(lesson)
}

export async function deleteLessonOnServer(id: string) {
  return deleteLessonAction(id)
}

export async function upsertStudioClient(body: { id: string; email: string; name: string; phone: string }) {
  return upsertStudioClientAction(body)
}

export async function putClientSubscriptions(clientId: string, subscriptions: unknown[]) {
  return putClientSubscriptionsAction(clientId, subscriptions)
}

export async function postBooking(body: {
  lessonId: string
  client_email: string
  client_name: string
  client_user_id?: string | null
  meta?: Record<string, unknown> | null
}) {
  return postBookingAction(body)
}

export async function postBookingWithSubscription(body: Parameters<typeof postBookingWithSubscriptionAction>[0]) {
  return postBookingWithSubscriptionAction(body)
}

export async function cancelBookingOnServer(lessonId: string, email: string) {
  return cancelBookingAction(lessonId, email)
}

export async function fetchLessonForCancel(lessonId: string, email: string) {
  return fetchLessonForCancelAction(lessonId, email)
}

export async function redeemPromoOnServer(body: { code: string; clientId: string; clientEmail: string }) {
  return redeemPromoAction(body)
}

export async function sendBookingEmail(payload: {
  email: string
  clientName: string
  className: string
  startTime: string
  trainerName: string
  lessonId: string
}) {
  return sendBookingEmailAction(payload)
}

export async function sendCancelBookingEmail(payload: {
  email: string
  clientName: string
  className: string
  startTime: string
}) {
  return sendCancelBookingEmailAction(payload)
}
