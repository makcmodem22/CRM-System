import type { Metadata } from 'next'
import { MapPin, Phone, Mail, FileText } from 'lucide-react'
import LegalShell from '@/components/legal/LegalShell'
import { BUSINESS_INFO } from '@/lib/businessInfo'

export const metadata: Metadata = {
  title: 'Про компанію — Brave! Yoga',
  description: 'Реєстраційні та контактні дані Brave! Yoga.',
}

export default function AboutPage() {
  return (
    <LegalShell>
      <article className="space-y-6">
        <header className="border-b border-white/[0.07] pb-4">
          <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.15em]">Про компанію</p>
          <h1 className="text-3xl font-bold tracking-tight mt-2">{BUSINESS_INFO.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{BUSINESS_INFO.servicesCategory}</p>
        </header>

        <section className="rounded-xl border border-white/[0.07] bg-muted/25 p-5 space-y-2">
          <h2 className="text-xs font-bold text-brand-gold uppercase tracking-[0.12em]">Реєстраційні дані</h2>
          <ul className="text-sm space-y-1.5 mt-2">
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">Найменування:</span><span className="font-semibold">{BUSINESS_INFO.legalName}</span></li>
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">{BUSINESS_INFO.registrationLabel}:</span><span className="font-semibold">{BUSINESS_INFO.registrationCode}</span></li>
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">Сфера діяльності:</span><span>{BUSINESS_INFO.servicesCategory}</span></li>
          </ul>
        </section>

        <section className="rounded-xl border border-white/[0.07] bg-muted/25 p-5 space-y-2">
          <h2 className="text-xs font-bold text-brand-gold uppercase tracking-[0.12em]">Контактні дані</h2>
          <ul className="text-sm space-y-2 mt-2">
            <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" /><span>{BUSINESS_INFO.addressLine}</span></li>
            <li className="flex items-start gap-2"><Phone className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" /><a href={`tel:${BUSINESS_INFO.phoneHref}`} className="text-foreground hover:text-brand-gold">{BUSINESS_INFO.phone}</a></li>
            <li className="flex items-start gap-2"><Mail className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" /><a href={`mailto:${BUSINESS_INFO.email}`} className="text-foreground hover:text-brand-gold break-all">{BUSINESS_INFO.email}</a></li>
          </ul>
        </section>

        <section className="space-y-3 pb-6">
          <h2 className="text-lg font-bold">Юридичні документи</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Ознайомтесь з умовами надання послуг та повернення коштів:</p>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="/offer" className="text-brand-gold hover:text-brand-gold-light transition-colors inline-flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Публічний договір (оферта)
              </a>
            </li>
            <li>
              <a href="/refunds" className="text-brand-gold hover:text-brand-gold-light transition-colors inline-flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Умови повернення коштів
              </a>
            </li>
          </ul>
        </section>
      </article>
    </LegalShell>
  )
}
