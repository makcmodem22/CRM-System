import 'server-only'

type Bucket = { hits: number[] }

const buckets = new Map<string, Bucket>()

/**
 * In-process sliding-window limiter. Returns true when the caller is allowed.
 * Best-effort across a single server instance — a distributed limiter (Upstash,
 * Vercel WAF) is preferred in production, but this still raises the cost of
 * password-spraying from "free" to "real" for any single attacker IP.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs
  const b = buckets.get(key) ?? { hits: [] }
  b.hits = b.hits.filter(t => t > cutoff)
  if (b.hits.length >= max) {
    buckets.set(key, b)
    return false
  }
  b.hits.push(now)
  buckets.set(key, b)
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (v.hits.length === 0 || v.hits[v.hits.length - 1] < cutoff) buckets.delete(k)
    }
  }
  return true
}

export function clientIpFromHeaders(h: Headers): string {
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return h.get('x-real-ip') || 'unknown'
}
