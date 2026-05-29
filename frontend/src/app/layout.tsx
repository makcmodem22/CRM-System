import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { BUSINESS_INFO } from '@/lib/businessInfo'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brave! Yoga — Студія твого балансу',
  description: 'Запис на заняття, абонементи та розклад.',
}

/**
 * Lock the mobile viewport so the page renders at the device's real width — without
 * this, an overlooked override or stray meta tag can leave iOS/Android rendering at
 * the desktop default (~980px) and the user sees a zoomed-in, cropped layout.
 * `maximumScale` is intentionally left unset so users can still pinch-zoom for
 * accessibility.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* Static fallback for crawlers / payment-provider verifiers that don't run JS:
            the SPA renders client-side only, so without this the homepage HTML carries no
            company data. Hidden once JS hydrates the app. */}
        <noscript>
          <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2.5rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
            <h1>{BUSINESS_INFO.name}</h1>
            <p>{BUSINESS_INFO.servicesCategory}.</p>
            <p>
              {BUSINESS_INFO.legalName}<br />
              {BUSINESS_INFO.registrationLabel}: {BUSINESS_INFO.registrationCode}
            </p>
            <p>
              {BUSINESS_INFO.addressLine}<br />
              <a href={`tel:${BUSINESS_INFO.phoneHref}`}>{BUSINESS_INFO.phone}</a><br />
              <a href={`mailto:${BUSINESS_INFO.email}`}>{BUSINESS_INFO.email}</a>
            </p>
            <p>
              <a href="/about">Про компанію</a> · <a href="/offer">Публічна оферта</a> · <a href="/refunds">Умови повернення</a>
            </p>
          </div>
        </noscript>
      </body>
    </html>
  )
}
