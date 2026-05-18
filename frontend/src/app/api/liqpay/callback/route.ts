import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LIQPAY_FAILED_STATUSES, LIQPAY_PAID_STATUSES, isLiqpaySandboxMode, parseCallback } from '@/lib/liqpay'
import { handleLiqpayPaidPayment, handleLiqpayFailedPayment } from '@/lib/studio-logic'
import { signBookingCancelToken } from '@/lib/admin-crypto'
import { sendBookingConfirmationEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

/**
 * LiqPay POSTs application/x-www-form-urlencoded with `data` (base64 JSON) and `signature`.
 * We verify the HMAC (LiqPay signs with our private key), then route by `status` to mark
 * StudioPayment paid/failed and run the side effects (confirm booking, grant subscription).
 *
 * We always return 200 OK on signature failure too — LiqPay retries on non-2xx, and a bad
 * signature is permanently bad, so retrying wastes effort. We log it instead.
 *
 * Defenses:
 *  - HMAC signature verification (constant-time compare in parseCallback)
 *  - Amount + currency must match the StudioPayment row we created
 *  - Status routing is allow-listed (PAID_STATUSES / FAILED_STATUSES)
 *  - Handlers are idempotent (SUCCESS rows return alreadyProcessed=true)
 */
export async function POST(req: Request) {
  let data: string | undefined
  let signature: string | undefined
  const ct = req.headers.get('content-type') || ''
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const form = await req.formData()
    data = (form.get('data') as string) || undefined
    signature = (form.get('signature') as string) || undefined
  } else {
    const body = (await req.json().catch(() => ({}))) as { data?: string; signature?: string }
    data = body.data
    signature = body.signature
  }

  const payload = parseCallback({ data, signature })
  if (!payload) {
    console.error('LiqPay callback: bad signature or payload')
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 200 })
  }

  const orderId = String(payload.order_id || '')
  if (!orderId) {
    console.error('LiqPay callback: missing order_id', payload)
    return NextResponse.json({ ok: false, error: 'missing_order_id' }, { status: 200 })
  }

  const payment = await prisma.studioPayment.findUnique({ where: { liqpay_order_id: orderId } })
  if (!payment) {
    console.error('LiqPay callback: unknown order_id', { orderId })
    return NextResponse.json({ ok: false, error: 'unknown_order' }, { status: 200 })
  }

  const liqpayStatus = String(payload.status || '')
  const liqpayPaymentId = payload.payment_id != null ? String(payload.payment_id) : null

  // Defense-in-depth against the "sandbox left on in prod" misconfig: a sandbox-status
  // callback should only ever arrive when LIQPAY_SANDBOX=1. If sandbox is off but we
  // still got status='sandbox', refuse to confirm — otherwise real users would get free
  // bookings/subscriptions without any card actually being charged.
  if (liqpayStatus === 'sandbox' && !isLiqpaySandboxMode()) {
    console.error('LiqPay callback: sandbox status received but sandbox mode disabled', { orderId })
    return NextResponse.json({ ok: false, error: 'sandbox_status_in_production' }, { status: 200 })
  }

  if (LIQPAY_PAID_STATUSES.has(liqpayStatus)) {
    if (payment.status === 'SUCCESS') return NextResponse.json({ ok: true, idempotent: true })
    // Amount/currency tamper guard. The signature already binds the payload to our private key,
    // but mismatching the StudioPayment row should never happen for a legitimate flow — log and
    // refuse so any anomaly is visible.
    const payloadAmount = Number(payload.amount)
    const payloadCurrency = String(payload.currency || 'UAH')
    if (!Number.isFinite(payloadAmount) || Math.round(payloadAmount) !== payment.amount) {
      console.error('LiqPay callback: amount mismatch', {
        orderId,
        expected: payment.amount,
        received: payload.amount,
      })
      return NextResponse.json({ ok: false, error: 'amount_mismatch' }, { status: 200 })
    }
    if (payloadCurrency !== payment.currency) {
      console.error('LiqPay callback: currency mismatch', {
        orderId,
        expected: payment.currency,
        received: payloadCurrency,
      })
      return NextResponse.json({ ok: false, error: 'currency_mismatch' }, { status: 200 })
    }

    const result = await handleLiqpayPaidPayment(payment.id, { liqpayPaymentId })
    if (!result.alreadyProcessed && result.emailContext) {
      try {
        const cancelToken = signBookingCancelToken(
          result.emailContext.bookingId,
          result.emailContext.lessonId,
          result.emailContext.startTimestamp,
        )
        await sendBookingConfirmationEmail({
          to: result.emailContext.to,
          clientName: result.emailContext.clientName,
          className: result.emailContext.className,
          startTimestamp: result.emailContext.startTimestamp,
          endTimestamp: result.emailContext.endTimestamp,
          trainerName: result.emailContext.trainerName,
          lessonId: result.emailContext.lessonId,
          cancelToken,
        })
      } catch (err) {
        console.error('LiqPay callback: confirmation email failed', err)
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (LIQPAY_FAILED_STATUSES.has(liqpayStatus)) {
    if (payment.status === 'FAILED') return NextResponse.json({ ok: true, idempotent: true })
    await handleLiqpayFailedPayment(payment.id, { liqpayStatus })
    return NextResponse.json({ ok: true })
  }

  // Anything else (e.g. 'wait_secure', 'processing') — keep the payment in CREATED and
  // wait for a terminal callback.
  return NextResponse.json({ ok: true, ignored: liqpayStatus })
}
