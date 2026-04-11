import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Monorepo: avoid tracing from repo root when a parent lockfile exists. */
  outputFileTracingRoot: path.join(process.cwd()),
  /**
   * Server Actions pull in `@supabase/ssr`. Without this, Webpack can emit
   * `vendor-chunks/@supabase` in the manifest but omit the file →
   * `__webpack_modules__[moduleId] is not a function` / MODULE_NOT_FOUND.
   */
  serverExternalPackages: [
    '@supabase/supabase-js',
    '@supabase/ssr',
    '@supabase/auth-js',
    '@supabase/postgrest-js',
    '@supabase/functions-js',
    '@supabase/realtime-js',
    '@supabase/storage-js',
    'nodemailer',
  ],
}

export default nextConfig
