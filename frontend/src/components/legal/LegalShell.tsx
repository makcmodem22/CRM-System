import type { ReactNode } from 'react'
import { MapPin, Phone, Mail, FileText, Building2 } from 'lucide-react'
import { BUSINESS_INFO } from '@/lib/businessInfo'
import logoImg from '@/assets/logo.png'

const logoSrc = typeof logoImg === 'string' ? logoImg : logoImg.src

/**
 * Server-rendered chrome (header + footer) for the public legal / info pages
 * (/about, /offer, /refunds). Unlike the SPA, these pages render their full
 * content as static HTML so payment-provider verifiers and crawlers that don't
 * run JavaScript can open them and read the company registration data.
 *
 * Links are plain `<a>` so navigating from the SPA footer triggers a full load
 * of the server-rendered route (the SPA has no react-router routes for them).
 */
export default function LegalShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0f1624]/90 text-foreground shadow-lg shadow-black/30 backdrop-blur-xl">
        <div className="container flex h-[4.25rem] items-center justify-between px-4 sm:px-8">
          <a href="/" className="flex gap-3 items-center group">
            <img src={logoSrc} alt="Brave! Yoga" className="w-11 h-11 rounded-full object-cover ring-2 ring-brand-gold/40 shadow-md" />
            <span className="flex flex-col leading-none gap-0.5">
              <span className="font-brand-script text-2xl text-brand-gold">Brave!</span>
              <span className="font-brand-sans text-[0.65rem] text-foreground/85 tracking-[0.2em]">Yoga</span>
            </span>
          </a>
          <a href="/" className="text-sm text-muted-foreground hover:text-brand-gold transition-colors">← На головну</a>
        </div>
      </header>

      <main className="flex-1 container px-4 sm:px-8 py-10 max-w-4xl">{children}</main>

      <footer className="border-t border-white/[0.07] bg-secondary/25 mt-12">
        <div className="container px-4 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src={logoSrc} alt="" className="w-8 h-8 rounded-full" />
              <span className="font-bold text-foreground tracking-tight">{BUSINESS_INFO.name}</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">{BUSINESS_INFO.servicesCategory}.</p>
            <p className="text-muted-foreground/80 leading-relaxed mt-3 text-xs">
              {BUSINESS_INFO.legalName}<br />
              {BUSINESS_INFO.registrationLabel}: {BUSINESS_INFO.registrationCode}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-brand-gold uppercase tracking-[0.15em] mb-3">Контакти</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                <span>{BUSINESS_INFO.addressLine}</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                <a href={`tel:${BUSINESS_INFO.phoneHref}`} className="text-foreground hover:text-brand-gold transition-colors">{BUSINESS_INFO.phone}</a>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                <a href={`mailto:${BUSINESS_INFO.email}`} className="text-foreground hover:text-brand-gold transition-colors break-all">{BUSINESS_INFO.email}</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold text-brand-gold uppercase tracking-[0.15em] mb-3">Інформація</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <a href="/about" className="hover:text-brand-gold transition-colors inline-flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Про компанію
                </a>
              </li>
              <li>
                <a href="/offer" className="hover:text-brand-gold transition-colors inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Публічна оферта
                </a>
              </li>
              <li>
                <a href="/refunds" className="hover:text-brand-gold transition-colors inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Умови повернення
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.05] py-4">
          <p className="container px-4 sm:px-8 text-xs text-muted-foreground/70 text-center md:text-left">
            © {new Date().getFullYear()} {BUSINESS_INFO.name}. Всі права захищено.
          </p>
        </div>
      </footer>
    </div>
  )
}
