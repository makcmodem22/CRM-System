import { NextResponse } from 'next/server'
import { constantTimeEqual } from '@/lib/admin-crypto'
import { sweepStalePendingPayments } from '@/lib/studio-logic'

export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  return constantTimeEqual(header, `Bearer ${secret}`)
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await sweepStalePendingPayments()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('Sweep stale payments failed', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: Request) { return run(req) }
export async function POST(req: Request) { return run(req) }
