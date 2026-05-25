import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
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
      <body>{children}</body>
    </html>
  )
}
