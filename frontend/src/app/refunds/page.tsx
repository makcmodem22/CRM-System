import type { Metadata } from 'next'
import { MapPin, Phone, Mail } from 'lucide-react'
import LegalShell from '@/components/legal/LegalShell'
import { BUSINESS_INFO } from '@/lib/businessInfo'

export const metadata: Metadata = {
  title: 'Умови повернення — Brave! Yoga',
  description: 'Як скасувати запис та як повертаються кошти.',
}

export default function RefundsPage() {
  return (
    <LegalShell>
      <article className="space-y-6">
        <header className="border-b border-white/[0.07] pb-4">
          <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.15em]">Підтримка клієнтів</p>
          <h1 className="text-3xl font-bold tracking-tight mt-2">Умови повернення</h1>
          <p className="text-sm text-muted-foreground mt-1">Як скасувати запис та як ми повертаємо кошти</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">1. Скасування запису на заняття</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Ви можете скасувати запис на заняття не пізніше ніж <strong className="text-foreground">за 1 (одну) годину до його початку</strong>.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">Скасувати запис можна у двох способах:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-1">
            <li>в особистому кабінеті на сайті — кнопка «Скасувати» біля відповідного запису;</li>
            <li>за посиланням з листа-підтвердження, який ми надіслали після успішного запису.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">2. Як повертаються кошти</h2>

          <div className="rounded-xl border border-white/[0.07] bg-muted/25 p-5 space-y-2">
            <h3 className="font-semibold text-foreground">Разові оплати</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">При своєчасному скасуванні кошти повертаються у повному обсязі тим самим способом, яким було здійснено оплату (на банківську картку через LiqPay). Термін повернення — <strong className="text-foreground">до 7 (семи) банківських днів</strong> з моменту скасування.</p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-muted/25 p-5 space-y-2">
            <h3 className="font-semibold text-foreground">Абонементи</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">При своєчасному скасуванні запису відвідування повертається на ваш абонемент, і його можна використати для запису на інше заняття у межах строку дії абонементу.</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">3. Якщо скасування відбулося пізніше ніж за 1 годину</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">У такому випадку:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-1">
            <li>кошти за разове відвідування не повертаються;</li>
            <li>відвідування не повертається на абонемент;</li>
            <li>правило діє також для випадків неявки без скасування.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">4. Якщо заняття було скасовано студією</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Якщо заняття не відбулося з вини студії (наприклад, через недостатню кількість учасників), <strong className="text-foreground">відвідування автоматично повертається на ваш абонемент</strong>, а кошти за разове відвідування повертаються у повному обсязі. Ви отримаєте лист-повідомлення на електронну пошту.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">5. Які послуги не підлягають поверненню</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-1">
            <li>активований абонемент після його часткового використання — поверненню не підлягає;</li>
            <li>послуги, які вже були надані (відвідане заняття);</li>
            <li>невикористані відвідування абонементу після завершення строку його дії;</li>
            <li>подарункові сертифікати після їх активації або використання.</li>
          </ul>
        </section>

        <section className="space-y-3 pb-6">
          <h2 className="text-lg font-bold">6. Як з нами зв’язатися</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">З будь-яких питань щодо повернення коштів зв’яжіться з нами:</p>
          <div className="rounded-xl border border-white/[0.07] bg-muted/25 p-5 text-sm space-y-1.5">
            <p className="flex items-start gap-2"><Mail className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" /><a href={`mailto:${BUSINESS_INFO.email}`} className="text-foreground hover:text-brand-gold break-all">{BUSINESS_INFO.email}</a></p>
            <p className="flex items-start gap-2"><Phone className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" /><a href={`tel:${BUSINESS_INFO.phoneHref}`} className="text-foreground hover:text-brand-gold">{BUSINESS_INFO.phone}</a></p>
            <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />{BUSINESS_INFO.addressLine}</p>
          </div>
          <p className="text-xs text-muted-foreground/80 mt-2">Ми відповідаємо на запити протягом 1–2 робочих днів.</p>
        </section>
      </article>
    </LegalShell>
  )
}
