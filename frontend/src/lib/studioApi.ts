'use client'

import {
  bootstrapStudioAction,
  putStudioConfigAction,
  createLessonAction,
  deleteLessonAction,
  updateLessonAction,
  upsertStudioClientAction,
  putClientSubscriptionsAction,
  postBookingAction,
  postBookingWithSubscriptionAction,
  cancelBookingAction,
  fetchLessonForCancelAction,
  redeemPromoAction,
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

export async function updateLessonOnServer(id: string, data: {
  class_name: string
  trainer_name: string
  start_timestamp: string
  end_timestamp: string
}) {
  return updateLessonAction(id, data)
}

export async function upsertStudioClient(body: { name: string; phone: string }) {
  return upsertStudioClientAction(body)
}

export async function putClientSubscriptions(subscriptions: unknown[]) {
  return putClientSubscriptionsAction(subscriptions)
}

export async function postBooking(body: { lessonId: string; meta?: Record<string, unknown> | null }) {
  return postBookingAction(body)
}

export async function postBookingWithSubscription(body: {
  lessonId: string
  subscriptionId: string
  meta?: Record<string, unknown> | null
}) {
  return postBookingWithSubscriptionAction(body)
}

export async function cancelBookingOnServer(args: { lessonId: string; token?: string }) {
  return cancelBookingAction(args)
}

export async function fetchLessonForCancel(args: { lessonId: string; token: string }) {
  return fetchLessonForCancelAction(args)
}

export async function redeemPromoOnServer(body: { code: string }) {
  return redeemPromoAction(body)
}
