'use client'

import {
  bootstrapStudioAction,
  putStudioConfigAction,
  createLessonAction,
  deleteLessonAction,
  updateLessonAction,
  upsertStudioClientAction,
  purchasePlanAction,
  postBookingAction,
  postBookingWithSubscriptionAction,
  postBookingPayAtStudioAction,
  cancelBookingAction,
  fetchLessonForCancelAction,
  redeemPromoAction,
  adminGrantCertificateAction,
  adminRevokeCertificateAction,
  listLessonSignupsAction,
  getPaymentStatusAction,
} from '@/app/actions/studio'

export type LessonSignup = {
  bookingId: string
  lessonId: string
  client_user_id: string | null
  name: string
  email: string
  phone: string
  status: 'CONFIRMED' | 'PENDING_PAYMENT'
  created_at: string
  subscription_kind?: 'paid' | 'gift'
  subscription_id?: string
  pay_at_studio?: boolean
  pay_amount?: number
}

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
    single_visit_price: number
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
  single_visit_price?: number
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
  single_visit_price?: number
}) {
  return updateLessonAction(id, data)
}

export async function upsertStudioClient(body: { name: string; phone: string }) {
  return upsertStudioClientAction(body)
}

export async function purchasePlanOnServer(planId: string): Promise<CheckoutResult> {
  return purchasePlanAction({ planId })
}

export type PaymentStatusPayload = {
  status: 'CREATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
  purpose: 'single_visit' | 'plan_purchase'
  amount: number
  bookingId: string | null
}

export async function fetchPaymentStatus(orderId: string): Promise<PaymentStatusPayload> {
  return getPaymentStatusAction({ orderId })
}

export type CheckoutResult =
  | { ok: true; orderId: string; checkoutUrl: string }
  | { ok: false; error: string }

export async function postBooking(body: { lessonId: string }): Promise<CheckoutResult> {
  return postBookingAction(body)
}

export async function postBookingWithSubscription(body: {
  lessonId: string
  subscriptionId: string
  meta?: Record<string, unknown> | null
}) {
  return postBookingWithSubscriptionAction(body)
}

export async function postBookingPayAtStudio(body: { lessonId: string }) {
  return postBookingPayAtStudioAction(body)
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

export async function adminGrantCertificateOnServer(body: {
  clientId: string
  name: string
  sessions: number
  durationDays: number
  price?: number
}) {
  return adminGrantCertificateAction(body)
}

export async function adminRevokeCertificateOnServer(body: { clientId: string; subscriptionId: string }) {
  return adminRevokeCertificateAction(body)
}

export async function fetchLessonSignups(lessonId: string): Promise<LessonSignup[]> {
  return listLessonSignupsAction(lessonId)
}
