/**
 * Public-facing legal / contact info — the single source of truth shared by the
 * client SPA footer/offer pages (src/App.tsx) and the server-rendered legal pages
 * (src/app/about, /offer, /refunds).
 *
 * LiqPay verifies that the registration data shown on the site matches the data in
 * the merchant cabinet, so `legalName` + `registrationLabel`/`registrationCode`
 * MUST be the exact values from the cabinet (a ФОП uses «РНОКПП», a ТОВ uses «ЄДРПОУ»).
 */
export const BUSINESS_INFO = {
  /** Brand / trade name shown in the header and footer. */
  name: 'Brave.Yoga',

  // ─── Registration data (must match the LiqPay merchant cabinet exactly) ───
  /** Full legal entity name, e.g. «ФОП Прізвище Ім’я По батькові» or «ТОВ «Назва»». */
  legalName: 'ФОП Семенович Катерина Михайлівна',
  /** «РНОКПП» (ІПН) for a ФОП, «ЄДРПОУ» for a ТОВ. */
  registrationLabel: 'РНОКПП',
  /** The actual tax / registration code. */
  registrationCode: '3281813628',

  addressLine: 'вул. Соборна, 17, м. Рівне, Україна',
  phone: '+380 97 902 6363',
  phoneHref: '+380979026363',
  email: 'Katya.sardyga@gmail.com',
  servicesCategory: 'Надання послуг у сфері здоров’я та оздоровчих практик',
} as const
