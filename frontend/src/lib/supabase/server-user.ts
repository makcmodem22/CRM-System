import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Logged-in Supabase Auth user id (server-side, cookie session). */
export async function getSupabaseUserId(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(list: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          /* ignore in Server Actions when cookies are read-only */
        }
      },
    },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}
