'use client'

import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Cookie-backed session so Server Actions (`getSupabaseUserId`) see the same user.
 * Plain `createClient` from `@supabase/supabase-js` keeps the session in localStorage only → always "Unauthorized" on the server.
 */
export const supabase = createBrowserClient(url, anon)
