import type { Metadata } from 'next'
import LegalShell from '@/components/legal/LegalShell'
import { BUSINESS_INFO } from '@/lib/businessInfo'

export const metadata: Metadata = {
  title: 'Публічна оферта — Brave! Yoga',
  description: 'Публічний договір про надання послуг у сфері здоров’я та оздоровчих практик.',
}

export default function OfferPage() {
  return (
    <LegalShell>
      <article className="space-y-6">
        <header className="border-b border-white/[0.07] pb-4">
          <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.15em]">Юридична інформація</p>
          <h1 className="text-3xl font-bold tracking-tight mt-2">Публічний договір (оферта)</h1>
          <p className="text-sm text-muted-foreground mt-1">Про надання послуг у сфері здоров’я та оздоровчих практик</p>
        </header>

        <section className="rounded-xl border border-white/[0.07] bg-muted/25 p-5 space-y-2">
          <h2 className="text-xs font-bold text-brand-gold uppercase tracking-[0.12em]">Виконавець</h2>
          <ul className="text-sm space-y-1.5 mt-2">
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">Найменування:</span><span className="font-semibold">{BUSINESS_INFO.legalName}</span></li>
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">{BUSINESS_INFO.registrationLabel}:</span><span className="font-semibold">{BUSINESS_INFO.registrationCode}</span></li>
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">Торгова назва:</span><span>{BUSINESS_INFO.name}</span></li>
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">Адреса:</span><span>{BUSINESS_INFO.addressLine}</span></li>
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">Телефон:</span><a href={`tel:${BUSINESS_INFO.phoneHref}`} className="text-foreground hover:text-brand-gold">{BUSINESS_INFO.phone}</a></li>
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">Ел. пошта:</span><a href={`mailto:${BUSINESS_INFO.email}`} className="text-foreground hover:text-brand-gold break-all">{BUSINESS_INFO.email}</a></li>
            <li className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">Сфера діяльності:</span><span>{BUSINESS_INFO.servicesCategory}</span></li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">1. Загальні положення</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">1.1. Цей документ є офіційною публічною офертою (далі — «Договір») від {BUSINESS_INFO.legalName} (далі — «Виконавець») фізичним особам (далі — «Клієнт») щодо надання послуг у сфері здоров’я та оздоровчих практик.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">1.2. Замовляючи послугу через сайт або здійснюючи оплату, Клієнт повністю та беззастережно приймає умови цього Договору.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">1.3. Виконавець залишає за собою право вносити зміни до цього Договору. Зміни набирають чинності з моменту їх публікації на сайті.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">2. Предмет договору</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">2.1. Виконавець надає Клієнту послуги у сфері здоров’я та оздоровчих практик: групові та індивідуальні заняття йогою, стретчингом та іншими оздоровчими практиками згідно з чинним розкладом, опублікованим на сайті.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">3. Порядок надання послуг</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">3.1. Розклад занять публікується на сайті Виконавця і може оновлюватися.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">3.2. Клієнт здійснює запис на конкретне заняття через особистий кабінет на сайті.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">3.3. Один запис надає право на участь в одному занятті відповідно до обраного тарифу — разове відвідування або списання сесії з абонементу.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">4. Вартість та порядок оплати</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">4.1. Вартість послуг визначається тарифами, що публікуються на сайті, у гривнях України.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">4.2. Оплата здійснюється безготівково через платіжний сервіс LiqPay банківською карткою або іншими доступними способами.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">4.3. Послуга вважається оплаченою з моменту зарахування коштів на рахунок Виконавця.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">4.4. Абонемент діє протягом терміну, зазначеного у момент придбання. Невикористані відвідування після закінчення строку не переносяться.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">5. Скасування запису та повернення коштів</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">5.1. Клієнт має право скасувати запис на заняття не пізніше ніж за 1 (одну) годину до його початку.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">5.2. У разі своєчасного скасування:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-1">
            <li>якщо заняття було оплачено окремою оплатою — кошти повертаються у повному обсязі на платіжний інструмент, з якого було здійснено оплату, упродовж до 7 (семи) банківських днів;</li>
            <li>якщо заняття було оплачено з абонементу — відвідування повертається на абонемент і доступне для повторного використання у межах строку дії абонементу.</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">5.3. У разі скасування пізніше ніж за 1 годину до початку заняття, або у разі неявки без скасування, кошти за разове відвідування не повертаються, а відвідування з абонементу не повертається.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">5.4. Якщо заняття не відбулося з вини Виконавця (зокрема через недостатню кількість учасників), відвідування автоматично повертається на абонемент, а кошти за разове відвідування повертаються Клієнту у повному обсязі. Клієнт отримає лист-повідомлення на електронну пошту.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">5.5. Активований абонемент після часткового використання поверненню не підлягає.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">6. Права та обов’язки сторін</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">6.1. Виконавець зобов’язаний надати послугу у визначений час та у вказаному місці.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">6.2. Виконавець має право скасувати заняття у разі надзвичайних обставин або недостатньої кількості учасників, повідомивши Клієнта електронною поштою.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">6.3. Клієнт зобов’язаний дотримуватись правил поведінки під час занять та інструкцій тренера.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">6.4. Клієнт зобов’язаний повідомити про наявні протипоказання за станом здоров’я до початку занять.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">7. Відповідальність сторін</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">7.1. Виконавець не несе відповідальності за стан здоров’я Клієнта під час занять, якщо Клієнт не повідомив про наявні протипоказання або не дотримувався інструкцій тренера.</p>
          <p className="text-sm text-muted-foreground leading-relaxed">7.2. У всьому, що не врегульовано цим Договором, сторони керуються чинним законодавством України.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">8. Персональні дані</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">8.1. Виконавець обробляє персональні дані Клієнта (ім’я, контактні дані, історія записів) виключно з метою надання послуг та відповідно до Закону України «Про захист персональних даних».</p>
          <p className="text-sm text-muted-foreground leading-relaxed">8.2. Дані платіжних карток на сайті не зберігаються; обробку платежів здійснює платіжний сервіс LiqPay.</p>
        </section>

        <section className="space-y-3 pb-6">
          <h2 className="text-lg font-bold">9. Реквізити та зв’язок</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Для будь-яких звернень — повернення коштів, претензій, скарг або питань щодо послуг — звертайтесь до Виконавця:</p>
          <div className="rounded-xl border border-white/[0.07] bg-muted/25 p-5 text-sm space-y-1.5">
            <p><span className="text-muted-foreground">Найменування:</span> <span className="font-semibold">{BUSINESS_INFO.legalName}</span></p>
            <p><span className="text-muted-foreground">{BUSINESS_INFO.registrationLabel}:</span> {BUSINESS_INFO.registrationCode}</p>
            <p><span className="text-muted-foreground">Адреса:</span> {BUSINESS_INFO.addressLine}</p>
            <p><span className="text-muted-foreground">Телефон:</span> <a href={`tel:${BUSINESS_INFO.phoneHref}`} className="text-foreground hover:text-brand-gold">{BUSINESS_INFO.phone}</a></p>
            <p><span className="text-muted-foreground">Ел. пошта:</span> <a href={`mailto:${BUSINESS_INFO.email}`} className="text-foreground hover:text-brand-gold break-all">{BUSINESS_INFO.email}</a></p>
          </div>
        </section>
      </article>
    </LegalShell>
  )
}
