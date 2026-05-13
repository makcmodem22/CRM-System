import { createHash } from 'crypto'

const CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout'
const REQUEST_URL = 'https://www.liqpay.ua/api/request'

function publicKey(): string {
  const k = process.env.LIQPAY_PUBLIC_KEY
  if (!k) throw new Error('LIQPAY_PUBLIC_KEY is not configured')
  return k
}

function privateKey(): string {
  const k = process.env.LIQPAY_PRIVATE_KEY
  if (!k) throw new Error('LIQPAY_PRIVATE_KEY is not configured')
  return k
}

function sandboxFlag(): 0 | 1 {
  return process.env.LIQPAY_SANDBOX === '1' ? 1 : 0
}

function sign(privateKeyValue: string, dataB64: string): string {
  return createHash('sha1').update(privateKeyValue + dataB64 + privateKeyValue).digest('base64')
}

function encodeData(payload: Record<string, unknown>): { data: string; signature: string } {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  const signature = sign(privateKey(), data)
  return { data, signature }
}

/** Constant-time string compare to avoid timing leaks on signature mismatch. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export type LiqpayCheckoutInput = {
  /** Our merchant order id — must be globally unique. */
  orderId: string
  /** UAH integer (LiqPay accepts decimal but we keep prices as integer hryvnia). */
  amount: number
  description: string
  /** Server webhook URL (must be public https). */
  serverUrl: string
  /** Where the user lands after the checkout flow finishes (success or cancel). */
  resultUrl: string
  /** ISO language code understood by LiqPay (uk/en/ru). */
  language?: 'uk' | 'en' | 'ru'
}

/**
 * Build a LiqPay hosted-checkout URL the browser can redirect to. No PCI scope on our side
 * because the user enters card details on liqpay.ua, not our domain.
 */
export function buildCheckoutUrl(input: LiqpayCheckoutInput): string {
  const payload = {
    public_key: publicKey(),
    version: 3,
    action: 'pay',
    amount: input.amount,
    currency: 'UAH',
    description: input.description,
    order_id: input.orderId,
    server_url: input.serverUrl,
    result_url: input.resultUrl,
    language: input.language || 'uk',
    sandbox: sandboxFlag(),
  }
  const { data, signature } = encodeData(payload)
  const params = new URLSearchParams({ data, signature })
  return `${CHECKOUT_URL}?${params.toString()}`
}

export type LiqpayCallbackPayload = {
  status: string
  order_id: string
  payment_id?: string | number
  amount?: number
  currency?: string
  err_code?: string
  err_description?: string
  [k: string]: unknown
}

/** Parse + verify a webhook body LiqPay POSTed to our server_url. Returns null on bad signature. */
export function parseCallback(body: { data?: string; signature?: string }): LiqpayCallbackPayload | null {
  if (!body.data || !body.signature) return null
  const expected = sign(privateKey(), body.data)
  if (!constantTimeEqual(expected, body.signature)) return null
  try {
    const decoded = Buffer.from(body.data, 'base64').toString('utf8')
    return JSON.parse(decoded) as LiqpayCallbackPayload
  } catch {
    return null
  }
}

/**
 * Server-to-server refund. LiqPay returns a JSON body with `status` (e.g. 'reversed' on success
 * for sandbox/non-installment, or 'ok' for some account types — caller should treat anything
 * other than success/reversed as failure and inspect `err_code`).
 */
export async function requestRefund(input: { orderId: string; amount: number }): Promise<{
  ok: boolean
  status?: string
  raw: unknown
}> {
  const payload = {
    public_key: publicKey(),
    version: 3,
    action: 'refund',
    order_id: input.orderId,
    amount: input.amount,
  }
  const { data, signature } = encodeData(payload)
  const body = new URLSearchParams({ data, signature })
  const res = await fetch(REQUEST_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const raw = (await res.json().catch(() => null)) as { status?: string; result?: string } | null
  const status = raw?.status || raw?.result
  const ok = status === 'reversed' || status === 'ok' || status === 'success'
  return { ok, status, raw }
}

/** Statuses LiqPay sends in callbacks that mean "money is in" (we treat the booking as paid). */
export const LIQPAY_PAID_STATUSES = new Set(['success', 'sandbox', 'wait_compensation', 'subscribed'])
/** Statuses that mean "this attempt is dead — release the slot". */
export const LIQPAY_FAILED_STATUSES = new Set(['failure', 'error', 'reversed'])
