import 'server-only'

/** Public site origin for email links (no trailing slash). */
export function publicSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (explicit) return explicit
  const v = process.env.VERCEL_URL
  if (v) return `https://${v.replace(/\/$/, '')}`
  return 'http://localhost:3000'
}
