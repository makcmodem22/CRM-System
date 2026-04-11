import { useState, useMemo, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, Outlet, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays } from 'date-fns'
import { uk } from 'date-fns/locale'
// @ts-ignore
import domtoimage from 'dom-to-image-more'
import {
  Calendar as CalendarIcon, Clock, Users, User,
  AlertTriangle, X, LogOut, Phone, Camera, Plus, Database, Settings,
  CreditCard, Mail, Lock, ChevronRight, Check, Crown, Eye, EyeOff,
  Ticket, Award, Star, BarChart3, TrendingUp, DollarSign, Wallet
} from 'lucide-react'

import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card'
import { Badge } from './components/ui/badge'
import {
  Dialog, DialogContent,
  DialogFooter, DialogHeader, DialogTitle
} from './components/ui/dialog'
import { Calendar } from './components/ui/calendar'
import { cn } from './lib/utils'
import { supabase } from './lib/supabase'
import logoImg from './assets/logo.png'

// ── Types ──────────────────────────────────────────────────────────────────
type LessonStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED'

interface ActualLesson {
  id: string
  class_name: string
  trainer_name: string
  start_timestamp: Date
  end_timestamp: Date
  capacity: number
  booked_count: number
  status: LessonStatus
  is_booked_by_me?: boolean
  my_booking_name?: string
  my_booking_email?: string
}

interface SubscriptionPlan {
  id: string
  name: string
  sessions: number
  price: number
  duration_days: number
}

interface ClientSubscription {
  id: string
  plan_id: string
  plan_name: string
  total_sessions: number
  used_sessions: number
  purchased_at: string
  expires_at: string
}

interface ClientBookingRecord {
  lessonId: string
  className: string
  date: string
  trainerName: string
}

interface Client {
  id: string
  name: string
  email: string
  phone: string
  password: string
  subscriptions: ClientSubscription[]
  bookings: ClientBookingRecord[]
}

interface PromoCode {
  code: string
  plan_id: string
  plan_name: string
  sessions: number
  duration_days: number
  created_at: string
  used: boolean
  used_by?: string // client email
}

// ── Constants ──────────────────────────────────────────────────────────────
const SINGLE_VISIT_PRICE = 300

const DEFAULT_PLANS: SubscriptionPlan[] = [
  { id: 'plan_4', name: 'Абонемент на 4 заняття', sessions: 4, price: 1000, duration_days: 30 },
  { id: 'plan_8', name: 'Абонемент на 8 занять', sessions: 8, price: 1800, duration_days: 30 },
  { id: 'plan_15', name: 'Абонемент на 15 занять', sessions: 15, price: 3000, duration_days: 30 },
]

const inputClasses = "flex h-10 w-full rounded-md border border-white/10 bg-muted/45 px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"

const makeDate = (baseDate: Date, h: number, m: number): Date => {
  const d = new Date(baseDate)
  d.setHours(h, m, 0, 0)
  return d
}

// ── Utility: Persistent State ──────────────────────────────────────────────
function usePersistentState<T>(key: string, initialValue: T, reviver?: (key: string, value: any) => any) {
  const [state, setState] = useState<T>(() => {
    try {
       const stored = localStorage.getItem(key)
       if (stored) return JSON.parse(stored, reviver)
    } catch(_e) {}
    return initialValue
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  return [state, setState] as const
}

const dateReviver = (_key: string, value: any) => {
  if (_key === 'start_timestamp' || _key === 'end_timestamp') return new Date(value)
  return value
}

// ── Helper: Get active subscription ────────────────────────────────────────
function getActiveSubscription(client: Client | null): ClientSubscription | null {
  if (!client) return null
  const now = new Date()
  return client.subscriptions.find(s => {
    const expires = new Date(s.expires_at)
    return s.used_sessions < s.total_sessions && now <= expires
  }) || null
}

// ── Shared Header ──────────────────────────────────────────────────────────
function Header({ role, onLogout, currentClient, onClientLogout }: {
  role: 'CLIENT'|'ADMIN'|'TRAINER',
  onLogout?: () => void,
  currentClient?: Client | null,
  onClientLogout?: () => void
}) {
  const navigate = useNavigate()
  const roleColors = {
    CLIENT:  'bg-brand-gold/20 text-brand-gold-light border-brand-gold/40',
    TRAINER: 'bg-white/10 text-white/95 border-white/25',
    ADMIN:   'bg-brand-gold/25 text-brand-gold-light border-brand-gold/45',
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0f1624]/90 text-foreground shadow-lg shadow-black/30 backdrop-blur-xl">
      <div className="container flex h-[4.25rem] items-center justify-between px-4 sm:px-8">
        <Link to={role === 'ADMIN' ? '/admin' : '/'} className="flex gap-3 items-center group">
          <img src={logoImg} alt="Brave! Yoga" className="w-11 h-11 rounded-full object-cover ring-2 ring-brand-gold/40 shadow-md" />
          <span className="flex flex-col leading-none gap-0.5">
            <span className="font-brand-script text-2xl text-brand-gold">Brave!</span>
            <span className="font-brand-sans text-[0.65rem] text-foreground/85 tracking-[0.2em]">Yoga</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {role === 'CLIENT' && currentClient && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-xs border-brand-gold/45 text-brand-gold bg-foreground/[0.04] hover:bg-brand-gold/15 hover:text-brand-gold-light gap-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                Кабінет
              </Button>
              <Button variant="ghost" size="icon" onClick={onClientLogout} className="text-muted-foreground rounded-full hover:bg-red-500/25 hover:text-red-200 w-8 h-8">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {role === 'CLIENT' && !currentClient && (
            <Button
              variant="brand"
              size="sm"
              onClick={() => navigate('/auth')}
              className="text-xs gap-1.5 h-9"
            >
              <User className="w-3.5 h-3.5" />
              Увійти
            </Button>
          )}
          {role === 'ADMIN' && (
            <>
              <Badge variant="outline" className={cn('uppercase tracking-widest text-[9px] px-2 py-0.5', roleColors[role])}>
                {role}
              </Badge>
              {onLogout && (
                <Button variant="ghost" size="icon" onClick={onLogout} className="text-muted-foreground rounded-full hover:bg-red-500/25 hover:text-red-200">
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Page: Client Home (Public) ──────────────────────────────────────────────
function ClientPage({ lessons, setLessons, currentClient, onClientLogout }: {
  lessons: ActualLesson[],
  setLessons: React.Dispatch<React.SetStateAction<ActualLesson[]>>,
  currentClient: Client | null,
  onClientLogout: () => void
}) {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [cancelLesson, setCancelLesson] = useState<ActualLesson | null>(null)
  const [isProcessingCancel, setIsProcessingCancel] = useState(false)
  const [cancelBlocked, setCancelBlocked] = useState(false)

  const filteredLessons = useMemo(() => {
    return lessons.filter(l => selectedDate && isSameDay(l.start_timestamp, selectedDate)).sort((a,b)=>a.start_timestamp.getTime()-b.start_timestamp.getTime())
  }, [lessons, selectedDate])

  const openCancelDialog = (lesson: ActualLesson) => {
    const hoursLeft = (lesson.start_timestamp.getTime() - Date.now()) / (1000 * 60 * 60)
    setCancelBlocked(hoursLeft < 6)
    setCancelLesson(lesson)
  }

  const handleConfirmCancel = async () => {
    if (!cancelLesson || cancelBlocked) return
    setIsProcessingCancel(true)
    await new Promise(r => setTimeout(r, 1000))
    setLessons(prev => prev.map(l => l.id === cancelLesson.id ? { ...l, is_booked_by_me: false, booked_count: l.booked_count - 1 } : l))
    setIsProcessingCancel(false)
    setCancelLesson(null)
  }

  const activeSub = getActiveSubscription(currentClient)

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Header role="CLIENT" currentClient={currentClient} onClientLogout={onClientLogout} />
      <main className="container px-4 sm:px-8 pt-10 pb-24 grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 lg:col-span-3 space-y-5">
          <Card className="border-white/[0.08] overflow-hidden bg-secondary/25 shadow-md shadow-black/15">
            <CardHeader className="pb-2 border-b border-white/[0.06] bg-muted/40">
              <CardTitle className="text-xs font-bold text-brand-gold uppercase tracking-[0.15em]">Оберіть дату</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 px-2">
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="mx-auto" />
            </CardContent>
          </Card>

          {/* Active Subscription Widget */}
          {currentClient && activeSub && (
            <Card className="relative overflow-hidden bg-gradient-to-br from-brand-navy to-brand-navy-dark text-primary-foreground shadow-lg border-0 ring-1 ring-brand-gold/25">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full border border-brand-gold/20" aria-hidden />
              <CardContent className="relative p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-brand-gold" />
                  <span className="text-xs font-bold text-brand-gold uppercase tracking-[0.12em]">Ваш абонемент</span>
                </div>
                <p className="font-bold text-sm">{activeSub.plan_name}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70">Відвідувань</span>
                    <span className="font-bold">{activeSub.used_sessions} / {activeSub.total_sessions}</span>
                  </div>
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full transition-all"
                      style={{ width: `${(activeSub.used_sessions / activeSub.total_sessions) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/50">
                    Залишилось {activeSub.total_sessions - activeSub.used_sessions} відвідувань • до {format(new Date(activeSub.expires_at), 'dd.MM.yyyy')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-8 lg:col-span-9 space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">Розклад занять</h2>
            <p className="text-sm text-muted-foreground mt-1">{selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy', { locale: uk }) : 'Оберіть дату'}</p>
          </div>

          <div className="grid gap-3">
            <AnimatePresence>
              {filteredLessons.map((lesson, idx) => {
                const isFull = lesson.booked_count >= lesson.capacity
                return (
                  <motion.div key={lesson.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.3 }}>
                    <Card className={cn("overflow-hidden border-white/[0.07] bg-muted/40 shadow-md shadow-black/20", lesson.is_booked_by_me ? "ring-1 ring-brand-gold/40 border-brand-gold/35" : "")}>
                      <div className={cn("h-1 w-full", lesson.is_booked_by_me ? "bg-gradient-to-r from-brand-navy to-brand-navy-dark" : "bg-gradient-to-r from-brand-gold to-brand-gold-light")} />
                      <div className="p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
                        <div className="space-y-2.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">{lesson.class_name}</h3>
                            {lesson.is_booked_by_me && <Badge className="bg-brand-gold text-brand-charcoal border-0 text-[10px] px-2">Ви записані</Badge>}
                            {isFull && !lesson.is_booked_by_me && <Badge variant="destructive" className="text-[10px] px-2">Місць немає</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{format(lesson.start_timestamp, 'HH:mm')} – {format(lesson.end_timestamp, 'HH:mm')}</span>
                            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{lesson.trainer_name}</span>
                            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{lesson.booked_count} / {lesson.capacity} місць</span>
                          </div>
                        </div>
                        <div className="w-full sm:w-auto shrink-0 flex gap-2">
                          {!lesson.is_booked_by_me ? (
                            <Button size="sm" disabled={isFull} onClick={() => navigate(`/book/${lesson.id}`)} className="w-full sm:w-28">
                              Записатись
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openCancelDialog(lesson)} className="w-full sm:w-28 border-red-400/35 text-red-300 hover:bg-red-500/15 hover:text-red-200">
                              Скасувати
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {filteredLessons.length === 0 && (
              <div className="py-24 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/60 backdrop-blur-sm">
                <p>На цей день не знайдено занять.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={!!cancelLesson} onOpenChange={open => !open && setCancelLesson(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {cancelBlocked ? <><X className="w-5 h-5 text-red-500" /> Скасування недоступне</> : <><AlertTriangle className="w-5 h-5 text-amber-500" /> Скасування бронювання</>}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
             {cancelBlocked ? (
               <p className="text-sm text-red-200 bg-red-950/40 p-4 rounded-xl border border-red-500/25">Скасування неможливе — до початку заняття залишилось менше 6 годин.</p>
             ) : (
               <p className="text-sm text-amber-100 bg-amber-950/35 p-4 rounded-xl border border-amber-500/25">Більше ніж 6 годин. Буде ініційовано повернення коштів (Refund).</p>
             )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelLesson(null)}>Закрити</Button>
            {!cancelBlocked && <Button variant="destructive" onClick={handleConfirmCancel} disabled={isProcessingCancel}>Скасувати запис</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Page: Booking Form (with Subscription Choice) ───────────────────────────
function BookingPage({ lessons, setLessons, currentClient, setClients, plans, onClientLogout }: {
  lessons: ActualLesson[],
  setLessons: React.Dispatch<React.SetStateAction<ActualLesson[]>>,
  currentClient: Client | null,
  setClients: React.Dispatch<React.SetStateAction<Client[]>>,
  plans: SubscriptionPlan[],
  onClientLogout: () => void
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const lesson = lessons.find(l => l.id === id)

  const [step, setStep] = useState<'choose' | 'single_form' | 'sub_confirm' | 'buy_plan' | 'success'>('choose')
  const [name, setName] = useState(currentClient?.name || '')
  const [phone, setPhone] = useState(currentClient?.phone || '')
  const [email, setEmail] = useState(currentClient?.email || '')
  const [isProcessing, setIsProcessing] = useState(false)

  const activeSub = getActiveSubscription(currentClient)

  if (!lesson) {
    return <div className="p-8 text-center">Заняття не знайдено <br/><Button onClick={()=>navigate('/')} className="mt-4">Назад</Button></div>
  }

  // ── Single visit booking ──
  const handleBookSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    try {
      await fetch('http://localhost:3000/api/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, clientName: name || 'Гість', className: lesson.class_name,
          startTime: format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk}),
          trainerName: lesson.trainer_name, lessonId: lesson.id
        })
      });
    } catch(e) { console.error(e) }
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_booked_by_me: true, booked_count: l.booked_count + 1, my_booking_name: name, my_booking_email: email } : l))
    setIsProcessing(false)
    setStep('success')
  }

  // ── Subscription booking ──
  const handleBookWithSub = async () => {
    if (!currentClient || !activeSub) return
    setIsProcessing(true)
    await new Promise(r => setTimeout(r, 800))

    // Update client subscription
    setClients(prev => prev.map(c => {
      if (c.id !== currentClient.id) return c
      return {
        ...c,
        subscriptions: c.subscriptions.map(s => s.id === activeSub.id ? { ...s, used_sessions: s.used_sessions + 1 } : s),
        bookings: [...c.bookings, { lessonId: lesson.id, className: lesson.class_name, date: new Date().toISOString(), trainerName: lesson.trainer_name }]
      }
    }))

    // Update lesson
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_booked_by_me: true, booked_count: l.booked_count + 1, my_booking_name: currentClient.name, my_booking_email: currentClient.email } : l))

    try {
      await fetch('http://localhost:3000/api/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentClient.email, clientName: currentClient.name, className: lesson.class_name,
          startTime: format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk}),
          trainerName: lesson.trainer_name, lessonId: lesson.id
        })
      });
    } catch(e) { console.error(e) }

    setIsProcessing(false)
    setStep('success')
  }

  // ── Buy subscription plan ──
  const handleBuyPlan = (plan: SubscriptionPlan) => {
    if (!currentClient) return
    const now = new Date()
    const newSub: ClientSubscription = {
      id: Math.random().toString(36).substr(2, 9),
      plan_id: plan.id,
      plan_name: plan.name,
      total_sessions: plan.sessions,
      used_sessions: 0,
      purchased_at: now.toISOString(),
      expires_at: addDays(now, plan.duration_days).toISOString()
    }
    setClients(prev => prev.map(c => {
      if (c.id !== currentClient.id) return c
      return { ...c, subscriptions: [...c.subscriptions, newSub] }
    }))
    // Go to sub confirm step now that client has an active subscription
    setStep('sub_confirm')
  }

  // ── Success screen ──
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="shadow-xl border-brand-gold/25 bg-card text-center ring-1 ring-brand-navy/5">
            <CardContent className="pt-10 pb-8 px-6 space-y-6">
              <div className="w-16 h-16 bg-brand-gold/25 text-brand-charcoal rounded-full flex items-center justify-center mx-auto mb-4 ring-2 ring-brand-gold/40">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Успішно заброньовано!</h2>
                <p className="text-muted-foreground">Час заняття: {format(lesson.start_timestamp, 'HH:mm')}</p>
                {activeSub && (
                  <p className="text-sm text-foreground mt-2 font-medium">
                    Списано 1 візит з абонементу (залишилось {activeSub.total_sessions - activeSub.used_sessions - 1})
                  </p>
                )}
              </div>
              <div className="bg-brand-gold/10 border border-brand-gold/25 rounded-xl p-4 text-left">
                <p className="text-sm font-semibold text-foreground mb-1">📩 Лист відправлено на пошту!</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ми надіслали підтвердження на <b>{currentClient?.email || email}</b>.<br/><br/>
                  У листі ви знайдете всю інформацію про заняття та посилання для скасування запису, якщо ваші плани зміняться.
                </p>
              </div>
              <Button variant="brand" className="w-full mt-4" onClick={() => navigate('/')}>Перейти до розкладу</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Header role="CLIENT" currentClient={currentClient} onClientLogout={onClientLogout} />
      <main className="flex-1 container max-w-2xl mx-auto p-4 sm:p-8 flex items-start justify-center pt-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
          {/* Lesson Info */}
          <div className="p-4 rounded-xl bg-muted/50 border border-white/[0.07] shadow-md shadow-black/20 space-y-2 mb-6">
            <div className="flex items-start gap-3">
              <img src={logoImg} alt="" className="w-10 h-10 rounded-full mt-0.5" />
              <div>
                <p className="font-bold text-foreground text-lg">{lesson.class_name}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk})}</span>
                  <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{lesson.trainer_name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step: Choose Type */}
          {step === 'choose' && (
            <div className="space-y-4">
              <div>
                <Button variant="ghost" className="p-0 h-auto mb-3 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={()=>navigate('/')}>← Назад до розкладу</Button>
                <h2 className="text-xl font-bold text-foreground">Оберіть тип візиту</h2>
                <p className="text-sm text-muted-foreground mt-1">Одноразовий візит або за абонементом</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Single Visit Card */}
                <Card
                  className="cursor-pointer border-2 border-transparent hover:border-border hover:shadow-md transition-all group"
                  onClick={() => setStep('single_form')}
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Ticket className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground">Одноразовий візит</h3>
                      <p className="text-sm text-muted-foreground mt-1">Без реєстрації. Просто заповніть форму.</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground">{SINGLE_VISIT_PRICE}</span>
                      <span className="text-sm text-muted-foreground">₴</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground/90 group-hover:text-muted-foreground transition-colors">
                      <span>Обрати</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>

                {/* Subscription Card */}
                <Card
                  className="cursor-pointer border-2 border-transparent hover:border-brand-gold/50 hover:shadow-md transition-all group relative overflow-hidden"
                  onClick={() => {
                    if (!currentClient) {
                      navigate(`/auth?redirect=/book/${lesson.id}`)
                    } else if (activeSub) {
                      setStep('sub_confirm')
                    } else {
                      setStep('buy_plan')
                    }
                  }}
                >
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-brand-gold to-brand-gold-light text-brand-charcoal text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                    Вигідно
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-gold/10 text-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Crown className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground">За абонементом</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentClient
                          ? activeSub
                            ? `Залишилось ${activeSub.total_sessions - activeSub.used_sessions} візитів`
                            : 'Оберіть план абонементу'
                          : 'Потрібна авторизація'}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-brand-gold">від {Math.min(...plans.map(p => Math.round(p.price / p.sessions)))}₴</span>
                      <span className="text-sm text-muted-foreground/90">за заняття</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground/90 group-hover:text-brand-gold transition-colors">
                      <span>Обрати</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step: Single Visit Form */}
          {step === 'single_form' && (
            <Card className="shadow-lg border-border">
              <CardHeader className="pb-4 border-b border-border/70 bg-muted/50 rounded-t-xl">
                <Button variant="ghost" className="w-fit p-0 h-auto mb-2 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setStep('choose')}>← Назад до вибору</Button>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-muted-foreground/90" />
                  Одноразовий візит — {SINGLE_VISIT_PRICE}₴
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {currentClient && (
                  <div className="mb-4 p-3 bg-brand-gold/10 border border-brand-gold/25 rounded-lg text-sm text-foreground flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" /> Дані підставлено з вашого профілю
                  </div>
                )}
                <form onSubmit={handleBookSingle} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Ваше ім'я</label>
                    <input required placeholder="Іван Іванов" value={name} onChange={e=>setName(e.target.value)} className={cn(inputClasses, currentClient ? 'bg-muted/70 text-muted-foreground' : '')} readOnly={!!currentClient} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Номер телефону</label>
                    <input required type="tel" placeholder="+380 99 000 00 00" value={phone} onChange={e=>setPhone(e.target.value)} className={cn(inputClasses, currentClient ? 'bg-muted/70 text-muted-foreground' : '')} readOnly={!!currentClient} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email для підтвердження</label>
                    <input required type="email" placeholder="ivan@example.com" value={email} onChange={e=>setEmail(e.target.value)} className={cn(inputClasses, currentClient ? 'bg-muted/70 text-muted-foreground' : '')} readOnly={!!currentClient} />
                  </div>
                  <Button type="submit" disabled={isProcessing} className="w-full h-11 mt-4 text-base">
                    {isProcessing ? 'Обробка...' : `Сплатити ${SINGLE_VISIT_PRICE}₴ та записатись`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Step: Subscription Confirm */}
          {step === 'sub_confirm' && currentClient && (
            <Card className="shadow-lg border-brand-gold/20">
              <CardHeader className="pb-4 border-b border-border/70 bg-brand-gold/5 rounded-t-xl">
                <Button variant="ghost" className="w-fit p-0 h-auto mb-2 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setStep('choose')}>← Назад до вибору</Button>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Crown className="w-5 h-5 text-brand-gold" />
                  Запис за абонементом
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {(() => {
                  const sub = getActiveSubscription(currentClient)
                  if (!sub) return <p>Не знайдено активний абонемент</p>
                  const remaining = sub.total_sessions - sub.used_sessions
                  return (
                    <>
                      <div className="bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white rounded-xl p-5 space-y-3">
                        <p className="text-sm font-semibold text-brand-gold">{sub.plan_name}</p>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/70">Залишилось візитів</span>
                          <span className="font-bold text-lg">{remaining}</span>
                        </div>
                        <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full" style={{ width: `${(sub.used_sessions / sub.total_sessions) * 100}%` }}/>
                        </div>
                        <p className="text-xs text-white/50">Дійсний до {format(new Date(sub.expires_at), 'dd.MM.yyyy')}</p>
                      </div>
                      <div className="bg-muted/70 rounded-xl p-4 space-y-2">
                        <p className="text-sm text-muted-foreground"><b>Клієнт:</b> {currentClient.name}</p>
                        <p className="text-sm text-muted-foreground"><b>Email:</b> {currentClient.email}</p>
                      </div>
                      <Button onClick={handleBookWithSub} disabled={isProcessing} variant="brand" className="w-full h-11 text-base">
                        {isProcessing ? 'Записуємо...' : 'Підтвердити запис (абонемент)'}
                      </Button>
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {/* Step: Buy Plan */}
          {step === 'buy_plan' && currentClient && (
            <div className="space-y-4">
              <Button variant="ghost" className="p-0 h-auto mb-1 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setStep('choose')}>← Назад до вибору</Button>
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><Award className="w-5 h-5 text-brand-gold" /> Оберіть абонемент</h2>
                <p className="text-sm text-muted-foreground mt-1">Абонемент дійсний 1 місяць з моменту покупки</p>
              </div>
              <div className="grid gap-4">
                {plans.map((plan, idx) => {
                  const perSession = Math.round(plan.price / plan.sessions)
                  const isBest = idx === plans.length - 1
                  return (
                    <Card key={plan.id} className={cn("border-2 transition-all hover:shadow-md", isBest ? "border-brand-gold/50 bg-brand-gold/5" : "border-transparent hover:border-border")}>
                      <CardContent className="p-5 flex items-center gap-5">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", isBest ? "bg-brand-gold text-brand-charcoal" : "bg-muted text-muted-foreground")}>
                          <Star className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground">{plan.name}</h3>
                            {isBest && <Badge className="bg-brand-gold text-brand-charcoal border-0 text-[10px]">Найвигідніший</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{plan.sessions} занять • {perSession}₴ за заняття • {plan.duration_days} днів</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xl font-black text-foreground">{plan.price}₴</p>
                          <Button size="sm" variant={isBest ? "brand" : "default"} className="mt-1" onClick={() => handleBuyPlan(plan)}>
                            Купити
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}

// ── Page: Cancel Booking from Email ─────────────────────────────────────────
function CancelBookingPage({ lessons, setLessons }: { lessons: ActualLesson[], setLessons: React.Dispatch<React.SetStateAction<ActualLesson[]>> }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const lesson = lessons.find(l => l.id === id && l.is_booked_by_me)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)

  if (!lesson && !isCancelled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <div>
          <AlertTriangle className="w-12 h-12 text-muted-foreground/90 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Бронювання не знайдено</h2>
          <p className="text-muted-foreground mb-6">Можливо, воно вже було скасовано або посилання застаріло.</p>
          <Button onClick={() => navigate('/')}>На головну</Button>
        </div>
      </div>
    )
  }

  const handleCancelClick = async () => {
    if (!lesson) return
    setIsProcessing(true)
    try {
      await fetch('http://localhost:3000/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: lesson.my_booking_email, clientName: lesson.my_booking_name || 'Гість',
          className: lesson.class_name, startTime: format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk})
        })
      });
    } catch(e) { console.error(e) }
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_booked_by_me: false, booked_count: l.booked_count - 1 } : l))
    setIsProcessing(false)
    setIsCancelled(true)
  }

  if (isCancelled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
           <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><X className="w-8 h-8" /></div>
           <h2 className="text-2xl font-bold text-foreground mb-2">Запис успішно скасовано</h2>
           <p className="text-muted-foreground mb-6">Ваше місце звільнено.</p>
           <Button onClick={() => navigate('/')}>Повернутись до розкладу</Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm">
        <Card className="shadow-lg border-red-100">
          <CardHeader className="text-center border-b border-border/70 bg-muted/40 rounded-t-xl pb-6">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6" /></div>
            <CardTitle className="text-xl font-bold text-foreground">Скасування запису</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Ви дійсно бажаєте скасувати свій запис?</p>
          </CardHeader>
          <CardContent className="pt-6 bg-muted/50">
            <div className="bg-muted/40 p-4 rounded-lg border border-white/[0.08] mb-6 space-y-2">
              <p className="font-bold text-foreground">{lesson?.class_name}</p>
              <p className="text-sm text-muted-foreground">{lesson ? format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk}) : ''}</p>
              <p className="text-sm text-muted-foreground">{lesson?.trainer_name}</p>
              <hr className="my-2" />
              <p className="text-xs text-muted-foreground/90">Пошта: {lesson?.my_booking_email}</p>
            </div>
            <Button variant="destructive" className="w-full h-11 text-base font-semibold" disabled={isProcessing} onClick={handleCancelClick}>
              {isProcessing ? 'Скасування...' : 'Так, скасувати запис'}
            </Button>
            <Button variant="ghost" className="w-full mt-2 text-muted-foreground" disabled={isProcessing} onClick={() => navigate('/')}>Повернутись</Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ── Page: Auth (Login / Register Tabs) ──────────────────────────────────────
function AuthPage({ clients, setClients, setCurrentClientId }: {
  clients: Client[],
  setClients: React.Dispatch<React.SetStateAction<Client[]>>,
  setCurrentClientId: (id: string | null) => void
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) {
      setError('Невірний email або пароль')
      return
    }
    // Sync client profile with localStorage
    let client = clients.find(c => c.id === data.user.id)
    if (!client) {
      const { data: profile } = await supabase.from('User').select('*').eq('id', data.user.id).single()
      if (profile) {
        client = { id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, password: '', subscriptions: [], bookings: [] }
        setClients(prev => [...prev, client!])
      }
    }
    if (client) setCurrentClientId(client.id)
    navigate(redirectTo)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    // 1. Create Supabase Auth user
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setLoading(false)
      if (signUpError.message.includes('already registered')) setError('Цей email вже зареєстровано')
      else setError(signUpError.message)
      return
    }
    const userId = data.user!.id
    // 2. Insert profile into User table
    await supabase.from('User').insert({ id: userId, email, name, phone, role: 'CLIENT' })
    // 3. Add to local clients state
    const newClient: Client = { id: userId, name, email, phone, password: '', subscriptions: [], bookings: [] }
    setClients(prev => [...prev, newClient])
    setCurrentClientId(userId)
    setLoading(false)
    navigate(redirectTo)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoImg} alt="Brave! Yoga" className="w-20 h-20 rounded-full mx-auto shadow-lg mb-4 ring-4 ring-brand-gold/25" />
          <h1 className="flex flex-col items-center gap-1">
            <span className="font-brand-script text-4xl text-brand-gold">Brave!</span>
            <span className="font-brand-sans text-[0.7rem] text-foreground/80 tracking-[0.28em]">Yoga</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Студія твого балансу</p>
        </div>

        <Card className="shadow-xl border-brand-gold/20 ring-1 ring-brand-navy/5 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border/80 bg-brand-navy/5">
            <button
              onClick={() => { setTab('login'); setError('') }}
              className={cn("flex-1 py-3.5 text-sm font-semibold transition-colors", tab === 'login' ? "text-brand-gold border-b-2 border-brand-gold bg-brand-gold/5" : "text-muted-foreground/90 hover:text-muted-foreground")}
            >
              Увійти
            </button>
            <button
              onClick={() => { setTab('register'); setError('') }}
              className={cn("flex-1 py-3.5 text-sm font-semibold transition-colors", tab === 'register' ? "text-brand-gold border-b-2 border-brand-gold bg-brand-gold/5" : "text-muted-foreground/90 hover:text-muted-foreground")}
            >
              Реєстрація
            </button>
          </div>

          <CardContent className="pt-6 pb-8">
            {error && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/25 rounded-lg text-sm text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</label>
                  <input required type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Пароль</label>
                  <div className="relative">
                    <input required type={showPass ? 'text' : 'password'} placeholder="Ваш пароль" value={password} onChange={e=>setPassword(e.target.value)} className={inputClasses} />
                    <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/90 hover:text-muted-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} variant="brand" className="w-full h-11 text-base">
                  {loading ? 'Завантаження...' : 'Увійти'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Ваше ім'я</label>
                  <input required placeholder="Іван Іванов" value={name} onChange={e=>setName(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</label>
                  <input required type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Телефон</label>
                  <input required type="tel" placeholder="+380 99 000 00 00" value={phone} onChange={e=>setPhone(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/90 mb-1 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Пароль</label>
                  <div className="relative">
                    <input required type={showPass ? 'text' : 'password'} placeholder="Придумайте пароль" value={password} onChange={e=>setPassword(e.target.value)} className={inputClasses} minLength={4} />
                    <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/90 hover:text-muted-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} variant="brand" className="w-full h-11 text-base">
                  {loading ? 'Реєстрація...' : 'Зареєструватись'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button variant="link" onClick={() => navigate('/')} className="text-muted-foreground/90 text-sm">
            ← На головну
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Page: Client Dashboard ──────────────────────────────────────────────────
function ClientDashboardPage({ currentClient, setClients, onClientLogout, plans, promoCodes, setPromoCodes }: {
  currentClient: Client | null,
  setClients: React.Dispatch<React.SetStateAction<Client[]>>,
  onClientLogout: () => void,
  plans: SubscriptionPlan[],
  promoCodes: PromoCode[],
  setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>
}) {
  const navigate = useNavigate()
  const [showBuyPlans, setShowBuyPlans] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoError, setPromoError] = useState<string|null>(null)
  const [promoSuccess, setPromoSuccess] = useState<string|null>(null)

  if (!currentClient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <img src={logoImg} alt="" className="w-16 h-16 rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Увійдіть до свого акаунту</h2>
          <p className="text-muted-foreground mb-6">Щоб бачити свій абонемент та дані</p>
          <Button onClick={() => navigate('/auth?redirect=/dashboard')} variant="brand">Увійти</Button>
        </div>
      </div>
    )
  }

  const activeSub = getActiveSubscription(currentClient)
  const allSubs = [...currentClient.subscriptions].reverse()

  const handleBuyPlan = (plan: SubscriptionPlan) => {
    const now = new Date()
    const newSub: ClientSubscription = {
      id: Math.random().toString(36).substr(2, 9),
      plan_id: plan.id,
      plan_name: plan.name,
      total_sessions: plan.sessions,
      used_sessions: 0,
      purchased_at: now.toISOString(),
      expires_at: addDays(now, plan.duration_days).toISOString()
    }
    setClients(prev => prev.map(c => {
      if (c.id !== currentClient.id) return c
      return { ...c, subscriptions: [...c.subscriptions, newSub] }
    }))
    setShowBuyPlans(false)
  }

  const handleActivatePromo = () => {
    setPromoError(null)
    setPromoSuccess(null)
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    const promo = promoCodes.find(p => p.code === code)
    if (!promo) { setPromoError('Невірний код. Перевірте правильність.'); return }
    if (promo.used) { setPromoError('Цей код вже використаний.'); return }
    // Activate: create subscription from promo
    const now = new Date()
    const newSub: ClientSubscription = {
      id: Math.random().toString(36).substr(2, 9),
      plan_id: promo.plan_id,
      plan_name: promo.plan_name + ' (Подарунок)',
      total_sessions: promo.sessions,
      used_sessions: 0,
      purchased_at: now.toISOString(),
      expires_at: addDays(now, promo.duration_days).toISOString()
    }
    setClients(prev => prev.map(c => {
      if (c.id !== currentClient.id) return c
      return { ...c, subscriptions: [...c.subscriptions, newSub] }
    }))
    setPromoCodes(prev => prev.map(p => p.code === code ? { ...p, used: true, used_by: currentClient.email } : p))
    setPromoInput('')
    setPromoSuccess(`Абонемент "${promo.plan_name}" успішно активовано!`)
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Header role="CLIENT" currentClient={currentClient} onClientLogout={onClientLogout} />
      <main className="container px-4 sm:px-8 pt-8 pb-24 max-w-4xl mx-auto">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-light text-brand-charcoal flex items-center justify-center text-xl font-bold shadow-lg ring-2 ring-brand-gold/40">
              {currentClient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{currentClient.name}</h1>
              <p className="text-sm text-muted-foreground">{currentClient.email} • {currentClient.phone}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Active Subscription Card */}
          <div className="md:col-span-2 space-y-6">
            {activeSub ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="overflow-hidden border-0 shadow-lg">
                  <div className="bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-brand-gold" />
                        <span className="text-sm font-bold text-brand-gold uppercase tracking-wider">Активний абонемент</span>
                      </div>
                      <Badge className="bg-brand-gold/25 text-brand-gold-light border-brand-gold/40 text-[10px]">Активний</Badge>
                    </div>
                    <h2 className="text-xl font-bold">{activeSub.plan_name}</h2>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 rounded-xl p-4 text-center">
                        <p className="text-3xl font-black text-brand-gold">{activeSub.used_sessions}</p>
                        <p className="text-xs text-white/60 mt-1">Відвідано</p>
                      </div>
                      <div className="bg-white/10 rounded-xl p-4 text-center">
                        <p className="text-3xl font-black text-white">{activeSub.total_sessions - activeSub.used_sessions}</p>
                        <p className="text-xs text-white/60 mt-1">Залишилось</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Прогрес</span>
                        <span className="font-bold">{activeSub.used_sessions} / {activeSub.total_sessions}</span>
                      </div>
                      <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(activeSub.used_sessions / activeSub.total_sessions) * 100}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-white/50 pt-2 border-t border-white/10">
                      <div>
                        <p className="text-white/40">Придбано</p>
                        <p className="text-white/80 font-semibold">{format(new Date(activeSub.purchased_at), 'dd.MM.yyyy')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40">Закінчується</p>
                        <p className="text-white/80 font-semibold">{format(new Date(activeSub.expires_at), 'dd.MM.yyyy')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40">Днів лишилось</p>
                        <p className="text-white/80 font-semibold">{Math.max(0, Math.ceil((new Date(activeSub.expires_at).getTime() - Date.now()) / (1000*60*60*24)))}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <Card className="border-dashed border-2 border-brand-gold/30 bg-brand-gold/5">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-brand-gold/10 text-brand-gold rounded-full flex items-center justify-center mx-auto">
                    <Crown className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">У вас немає активного абонементу</h3>
                    <p className="text-sm text-muted-foreground mt-1">Придбайте абонемент та економте на кожному занятті!</p>
                  </div>
                  <Button onClick={() => setShowBuyPlans(true)} variant="brand">
                    <CreditCard className="w-4 h-4 mr-2" /> Придбати абонемент
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Booking History */}
            <Card className="border-border">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="text-base font-bold flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-muted-foreground/90" /> Історія відвідувань</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {currentClient.bookings.length > 0 ? (
                  <div className="space-y-2">
                    {[...currentClient.bookings].reverse().map((b, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/70 hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-brand-gold/25 text-brand-charcoal flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{b.className}</p>
                          <p className="text-xs text-muted-foreground">{b.trainerName} • {format(new Date(b.date), 'dd.MM.yyyy, HH:mm')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/90 text-center py-6">Поки немає записів. Забронюйте перше заняття!</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <Button className="w-full" onClick={() => navigate('/')}>
                  <CalendarIcon className="w-4 h-4 mr-2" /> Переглянути розклад
                </Button>
                {activeSub && (
                  <Button variant="outline" className="w-full border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10" onClick={() => setShowBuyPlans(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Ще абонемент
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Subscription History */}
            {allSubs.length > 0 && (
              <Card>
                <CardHeader className="pb-2 border-b border-border/70">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Усі абонементи</CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-2">
                  {allSubs.map((s, idx) => {
                    const isExpired = new Date(s.expires_at) < new Date()
                    const isUsedUp = s.used_sessions >= s.total_sessions
                    const isActive = !isExpired && !isUsedUp
                    return (
                      <div key={idx} className={cn("p-3 rounded-lg border text-xs", isActive ? "border-brand-gold/40 bg-brand-gold/10" : "border-border bg-muted/70 opacity-60")}>
                        <p className="font-bold text-foreground">{s.plan_name}</p>
                        <p className="text-muted-foreground mt-1">{s.used_sessions}/{s.total_sessions} візитів</p>
                        <div className="flex justify-between mt-1">
                          <span className="text-muted-foreground/90">{format(new Date(s.purchased_at), 'dd.MM')}-{format(new Date(s.expires_at), 'dd.MM.yy')}</span>
                          {isActive && <Badge className="bg-brand-gold text-brand-charcoal border-0 text-[8px] px-1.5">Активний</Badge>}
                          {isExpired && <Badge variant="outline" className="text-[8px] px-1.5 text-muted-foreground/90">Прострочений</Badge>}
                          {isUsedUp && !isExpired && <Badge variant="outline" className="text-[8px] px-1.5 text-muted-foreground/90">Використаний</Badge>}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {/* Promo Code Activation */}
            <Card className="border-brand-gold/30">
              <CardHeader className="pb-2 border-b border-brand-gold/20">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Ticket className="w-4 h-4" /> Активувати подарунок
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Якщо вам подарували промо-код, введіть його нижче:</p>
                <input
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); setPromoSuccess(null) }}
                  placeholder="BRAVE-XXXXXXXX"
                  className={inputClasses + ' font-mono text-sm tracking-widest'}
                />
                {promoError && <p className="text-xs text-red-500">{promoError}</p>}
                {promoSuccess && <p className="text-xs text-foreground font-semibold">✓ {promoSuccess}</p>}
                <Button
                  onClick={handleActivatePromo}
                  disabled={!promoInput.trim()}
                  variant="brand"
                  className="w-full text-sm"
                >
                  <Check className="w-4 h-4 mr-1" /> Активувати
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Buy Plans Dialog */}
      <Dialog open={showBuyPlans} onOpenChange={setShowBuyPlans}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><Award className="w-5 h-5 text-brand-gold" /> Придбати абонемент</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Абонемент дійсний 1 місяць з моменту покупки</p>
            {plans.map((plan, idx) => {
              const perSession = Math.round(plan.price / plan.sessions)
              const isBest = idx === plans.length - 1
              return (
                <div key={plan.id} className={cn("p-4 rounded-xl border-2 flex items-center gap-4 transition-all hover:shadow-md cursor-pointer", isBest ? "border-brand-gold/50 bg-brand-gold/5" : "border-border hover:border-border")} onClick={() => handleBuyPlan(plan)}>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isBest ? "bg-brand-gold text-brand-charcoal" : "bg-muted text-muted-foreground")}>
                    <Star className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{plan.name}</span>
                      {isBest && <Badge className="bg-brand-gold text-brand-charcoal border-0 text-[9px]">Хіт</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{plan.sessions} занять • {perSession}₴/заняття</p>
                  </div>
                  <span className="text-lg font-black text-foreground">{plan.price}₴</span>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Admin Layout & Login ────────────────────────────────────────────────────
function AdminLayout({ isAdminLogged, setIsAdminLogged }: { isAdminLogged: boolean, setIsAdminLogged: (b: boolean) => void }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')

  if (!isAdminLogged) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <img src={logoImg} alt="Brave! Yoga" className="w-16 h-16 rounded-full mx-auto mb-2 shadow-lg" />
            <CardTitle className="text-center">Вхід для Адміністратора</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => { e.preventDefault(); if(password==='admin123') setIsAdminLogged(true); else alert('Невірний пароль!') }}>
              <input type="password" required placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} className={inputClasses} />
              <Button type="submit" variant="brand" className="w-full mt-4">Увійти</Button>
              <Button type="button" variant="link" onClick={()=>navigate('/')} className="w-full mt-2 text-muted-foreground/90">На головну</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header role="ADMIN" onLogout={() => setIsAdminLogged(false)} />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

// ── Page: Admin Hub (Menu) ──────────────────────────────────────────────────
function AdminHub() {
  const navigate = useNavigate()

  return (
    <div className="container p-4 sm:p-12 flex flex-col items-center justify-center mt-10">
      <img src={logoImg} alt="" className="w-16 h-16 rounded-full shadow-lg mb-4 ring-2 ring-brand-gold/30" />
      <h1 className="text-3xl font-bold mb-2 text-foreground tracking-tight">Меню Адміністратора</h1>
      <p className="text-sm text-muted-foreground mb-8">Brave! Yoga — внутрішня панель</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        <Card className="cursor-pointer hover:border-brand-gold/40 hover:shadow-lg transition-all group border-border/80" onClick={() => navigate('/admin/schedule')}>
          <CardContent className="flex flex-col items-center p-10 text-center gap-4">
             <div className="w-20 h-20 rounded-2xl bg-secondary text-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform ring-1 ring-brand-gold/25">
               <CalendarIcon className="w-10 h-10" />
             </div>
             <div>
               <h2 className="text-xl font-bold">Розклад занять</h2>
               <p className="text-sm text-muted-foreground mt-2">Редагування тижневого графіку, скасування занять, генерація фото для соцмереж.</p>
             </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-brand-gold/40 hover:shadow-lg transition-all group border-border/80" onClick={() => navigate('/admin/settings')}>
          <CardContent className="flex flex-col items-center p-10 text-center gap-4">
             <div className="w-20 h-20 rounded-2xl bg-brand-gold/15 text-brand-gold-hover flex items-center justify-center group-hover:scale-110 transition-transform ring-1 ring-brand-gold/25">
               <Database className="w-10 h-10" />
             </div>
             <div>
               <h2 className="text-xl font-bold">База Даних</h2>
               <p className="text-sm text-muted-foreground mt-2">Тренери, формати занять та управління абонементами.</p>
             </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-brand-gold/40 hover:shadow-lg transition-all group border-border/80" onClick={() => navigate('/admin/stats')}>
          <CardContent className="flex flex-col items-center p-10 text-center gap-4">
             <div className="w-20 h-20 rounded-2xl bg-primary/25 text-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform ring-1 ring-brand-gold/25">
               <BarChart3 className="w-10 h-10" />
             </div>
             <div>
               <h2 className="text-xl font-bold">Статистика</h2>
               <p className="text-sm text-muted-foreground mt-2">Зарплати тренерів, доходи адміна та детальна аналітика.</p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Page: Admin Settings (Manage Trainers, Classes & Subscription Plans) ────
function AdminSettingsPage({ trainers, setTrainers, classTypes, setClassTypes, plans, setPlans, promoCodes, setPromoCodes }: {
  trainers: string[], setTrainers: React.Dispatch<React.SetStateAction<string[]>>,
  classTypes: string[], setClassTypes: React.Dispatch<React.SetStateAction<string[]>>,
  plans: SubscriptionPlan[], setPlans: React.Dispatch<React.SetStateAction<SubscriptionPlan[]>>,
  promoCodes: PromoCode[], setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>
}) {
  const [newTrainer, setNewTrainer] = useState('')
  const [newClass, setNewClass] = useState('')
  const navigate = useNavigate()

  // New plan form
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanSessions, setNewPlanSessions] = useState('')
  const [newPlanPrice, setNewPlanPrice] = useState('')
  const [newPlanDays, setNewPlanDays] = useState('30')

  // Promo code generation
  const [promoSelectedPlanId, setPromoSelectedPlanId] = useState('')
  const [copiedCode, setCopiedCode] = useState<string|null>(null)

  const generateCode = () => {
    if (!promoSelectedPlanId) return
    const plan = plans.find(p => p.id === promoSelectedPlanId)
    if (!plan) return
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = 'BRAVE-' + Array.from({length: 8}, () => chars[Math.floor(Math.random()*chars.length)]).join('')
    const promo: PromoCode = {
      code,
      plan_id: plan.id,
      plan_name: plan.name,
      sessions: plan.sessions,
      duration_days: plan.duration_days,
      created_at: new Date().toISOString(),
      used: false
    }
    setPromoCodes(prev => [promo, ...prev])
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleAddTrainer = (e: React.FormEvent) => {
    e.preventDefault()
    if(!newTrainer.trim()) return
    setTrainers(p => [...p, newTrainer.trim()])
    setNewTrainer('')
  }

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault()
    if(!newClass.trim()) return
    setClassTypes(p => [...p, newClass.trim()])
    setNewClass('')
  }

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault()
    if(!newPlanName.trim() || !newPlanSessions || !newPlanPrice) return
    const plan: SubscriptionPlan = {
      id: 'plan_' + Math.random().toString(36).substr(2, 6),
      name: newPlanName.trim(),
      sessions: parseInt(newPlanSessions),
      price: parseInt(newPlanPrice),
      duration_days: parseInt(newPlanDays) || 30
    }
    setPlans(p => [...p, plan])
    setNewPlanName('')
    setNewPlanSessions('')
    setNewPlanPrice('')
    setNewPlanDays('30')
  }

  return (
    <div className="container p-4 sm:p-8 max-w-6xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4">← Назад у меню</Button>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground"><Settings className="w-6 h-6 text-brand-gold" /> Налаштування Бази</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Trainers Panel */}
        <Card>
          <CardHeader className="bg-brand-navy/5 pb-4 border-b border-border/60 mb-4">
            <CardTitle className="text-foreground">Список Тренерів</CardTitle>
            <CardDescription>Ці тренери будуть доступні у вигляді випадаючого списку при створенні графіка.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddTrainer} className="flex gap-2">
               <input required placeholder="Ім'я тренера" value={newTrainer} onChange={e=>setNewTrainer(e.target.value)} className={inputClasses} />
               <Button type="submit" className="shrink-0"><Plus className="w-4 h-4 mr-1"/> Додати</Button>
            </form>
            <div className="space-y-2">
              {trainers.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/70">
                  <span className="font-semibold text-foreground/90">{t}</span>
                  <button onClick={() => { if(confirm('Видалити?')) setTrainers(p => p.filter(x => x !== t)) }} className="text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded text-xs transition-colors">Видалити</button>
                </div>
              ))}
              {trainers.length === 0 && <p className="text-sm text-muted-foreground/90 italic">Додайте тренерів.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Classes Panel */}
        <Card>
          <CardHeader className="bg-brand-gold/10 pb-4 border-b border-border/60 mb-4">
            <CardTitle className="text-foreground">Типи Занять</CardTitle>
            <CardDescription>Вкажіть назви занять, які проходять у вашому спортзалі.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddClass} className="flex gap-2">
               <input required placeholder="Назва заняття" value={newClass} onChange={e=>setNewClass(e.target.value)} className={inputClasses} />
               <Button type="submit" variant="brand" className="shrink-0"><Plus className="w-4 h-4 mr-1"/> Додати</Button>
            </form>
            <div className="space-y-2">
              {classTypes.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/70">
                  <span className="font-semibold text-foreground/90">{c}</span>
                  <button onClick={() => { if(confirm('Видалити?')) setClassTypes(p => p.filter(x => x !== c)) }} className="text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded text-xs transition-colors">Видалити</button>
                </div>
              ))}
              {classTypes.length === 0 && <p className="text-sm text-muted-foreground/90 italic">Жодного заняття не збережено.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Plans Panel */}
        <Card>
          <CardHeader className="bg-brand-gold/10 pb-4 border-b mb-4">
            <CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-brand-gold" /> Абонементи</CardTitle>
            <CardDescription>Створюйте та редагуйте плани абонементів для клієнтів.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddPlan} className="space-y-3">
              <input required placeholder="Назва (напр. Абонемент на 10 занять)" value={newPlanName} onChange={e=>setNewPlanName(e.target.value)} className={inputClasses} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground/90 uppercase font-bold">Занять</label>
                  <input required type="number" min="1" placeholder="К-сть" value={newPlanSessions} onChange={e=>setNewPlanSessions(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground/90 uppercase font-bold">Ціна (₴)</label>
                  <input required type="number" min="1" placeholder="Ціна" value={newPlanPrice} onChange={e=>setNewPlanPrice(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground/90 uppercase font-bold">Днів</label>
                  <input required type="number" min="1" placeholder="30" value={newPlanDays} onChange={e=>setNewPlanDays(e.target.value)} className={inputClasses} />
                </div>
              </div>
              <Button type="submit" variant="brand" className="w-full"><Plus className="w-4 h-4 mr-1"/> Створити абонемент</Button>
            </form>
            <div className="space-y-2">
              {plans.map(plan => (
                <div key={plan.id} className="p-3 border border-border rounded-lg hover:bg-muted/70 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground/90 text-sm">{plan.name}</span>
                    <button onClick={() => { if(confirm('Видалити план?')) setPlans(p => p.filter(x => x.id !== plan.id)) }} className="text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded text-xs transition-colors">Видалити</button>
                  </div>
                  <p className="text-xs text-muted-foreground/90">{plan.sessions} занять • {plan.price}₴ • {plan.duration_days} днів</p>
                </div>
              ))}
              {plans.length === 0 && <p className="text-sm text-muted-foreground/90 italic">Жодного абонементу. Створіть перший!</p>}
            </div>
          </CardContent>
        </Card>

        {/* Promo Codes Panel */}
        <Card className="md:col-span-1 lg:col-span-3">
          <CardHeader className="bg-brand-navy/5 pb-4 border-b border-border/60 mb-4">
            <CardTitle className="flex items-center gap-2 text-foreground"><Ticket className="w-5 h-5 text-brand-gold" /> Промо-коди (Подарунки)</CardTitle>
            <CardDescription>Генеруйте унікальні коди абонементів для друзів або в подарунок. Клієнт вводить код в особистому кабінеті.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Generator */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">Оберіть план та згенеруйте код:</p>
                <select
                  value={promoSelectedPlanId}
                  onChange={e => setPromoSelectedPlanId(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">— Оберіть абонемент —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sessions} занять, {p.price}₴)</option>
                  ))}
                </select>
                <Button
                  onClick={generateCode}
                  disabled={!promoSelectedPlanId}
                  variant="brand"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-1" /> Згенерувати код
                </Button>
              </div>

              {/* Code list */}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {promoCodes.length === 0 && <p className="text-sm text-muted-foreground/90 italic">Ще немає жодного коду.</p>}
                {promoCodes.map(pc => (
                  <div key={pc.code} className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-sm ${
                    pc.used ? 'bg-muted/70 border-border opacity-60' : 'bg-brand-gold/10 border-brand-gold/30'
                  }`}>
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-foreground tracking-wider">{pc.code}</p>
                      <p className="text-xs text-muted-foreground">{pc.plan_name}</p>
                      {pc.used && <p className="text-xs text-red-500 mt-0.5">Використано{pc.used_by ? ` — ${pc.used_by}` : ''}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!pc.used && (
                        <button
                          onClick={() => copyCode(pc.code)}
                          className="px-2 py-1 rounded text-xs bg-brand-navy text-primary-foreground hover:bg-brand-navy-dark transition-colors"
                        >
                          {copiedCode === pc.code ? '✓ Скопійовано' : 'Копіювати'}
                        </button>
                      )}
                      <button
                        onClick={() => { if(confirm('Видалити код?')) setPromoCodes(prev => prev.filter(x => x.code !== pc.code)) }}
                        className="text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded text-xs transition-colors"
                      >Видалити</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Table-Grid Export Poster (Brave! Yoga style) ────────────────────────────
function SocialMediaPoster({ lessons, weekStart, weekEnd }: { lessons: ActualLesson[], weekStart: Date, weekEnd: Date }) {
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Суб', 'Нд']

  const timeSlots: string[] = []
  const timeSlotsSet = new Set<string>()
  lessons.forEach(l => {
    const key = format(l.start_timestamp, 'HH:mm')
    if (!timeSlotsSet.has(key)) { timeSlotsSet.add(key); timeSlots.push(key) }
  })
  timeSlots.sort()

  const findLesson = (day: Date, timeSlot: string): ActualLesson | undefined => {
    return lessons.find(l => isSameDay(l.start_timestamp, day) && format(l.start_timestamp, 'HH:mm') === timeSlot)
  }

  const CANVAS = 1080
  const FIRST_COL_W = 104
  const ROW_H = timeSlots.length > 0 ? Math.max(96, Math.min(Math.floor(720 / timeSlots.length), 140)) : 88
  const GOLD = '#e2bc5a'
  const GOLD_SOFT = '#edd078'
  const NAVY_HEADER = '#3b5284'
  const NAVY_DEEP = '#2d3f66'
  const PAGE_BG = '#141c2e'
  const TABLE_SKIN = '#1e2a42'
  const ROW_A = '#1e2a42'
  const ROW_B = '#263652'
  const TEXT_MAIN = '#e8eef8'
  const TEXT_MUTED = '#9eb0d0'
  const BORDER = 'rgba(255,255,255,0.1)'
  const HEADER_GRAD = `linear-gradient(135deg, ${NAVY_HEADER} 0%, ${NAVY_DEEP} 100%)`

  const cellLessonTitle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 800,
    color: TEXT_MAIN,
    lineHeight: 1.35,
    marginBottom: '6px',
    letterSpacing: '-0.01em',
    maxWidth: '100%',
    width: '100%',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical' as const,
    WebkitLineClamp: 2,
    wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const,
    boxSizing: 'border-box' as const,
  }

  const cellTrainerPill: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: GOLD_SOFT,
    lineHeight: 1.5,
    backgroundColor: 'rgba(226, 188, 90, 0.16)',
    border: '1px solid rgba(226, 188, 90, 0.35)',
    padding: '7px 10px',
    borderRadius: '10px',
    maxWidth: '100%',
    width: '100%',
    boxSizing: 'border-box' as const,
    wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const,
    textAlign: 'center' as const,
    display: 'block',
  }

  return (
    <div style={{ position: 'fixed', top: '-99999px', left: '-99999px', width: `${CANVAS}px`, height: `${CANVAS}px` }}>
      <div
        id="printable-schedule"
        style={{
          width: `${CANVAS}px`, height: `${CANVAS}px`,
          background: `linear-gradient(165deg, ${PAGE_BG} 0%, #1a2740 45%, #1e324d 100%)`,
          color: TEXT_MAIN,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Plus Jakarta Sans", "Inter", "Segoe UI", system-ui, sans-serif',
          overflow: 'hidden',
          boxSizing: 'border-box',
          padding: '36px 44px',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          #printable-schedule, #printable-schedule * { box-sizing: border-box; }
          #printable-schedule * { outline: none; }
        ` }} />

        {/* HEADER — stacked wordmark avoids baseline/italic overlap in raster export */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            flexShrink: 0,
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: '54px',
                lineHeight: 1,
                fontStyle: 'italic',
                fontWeight: 600,
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                color: GOLD,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                paddingBottom: '4px',
              }}
            >
              Brave!
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '36px',
                lineHeight: 1.15,
                fontWeight: 800,
                fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: TEXT_MAIN,
                whiteSpace: 'nowrap',
                marginTop: '2px',
              }}
            >
              Yoga
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(180deg, rgba(226,188,90,0.42) 0%, rgba(226,188,90,0.28) 100%)`,
              border: '1px solid rgba(226,188,90,0.5)',
              padding: '12px 28px',
              borderRadius: '999px',
              minHeight: '46px',
              maxWidth: '92%',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: '#121518',
                textTransform: 'uppercase',
                lineHeight: 1.35,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {format(weekStart, 'dd.MM')} — {format(weekEnd, 'dd.MM.yyyy')}
            </span>
          </div>
        </div>

        {/* TABLE */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '22px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(226,188,90,0.2)',
          border: `1px solid ${BORDER}`,
          overflow: 'hidden',
          background: TABLE_SKIN,
          minHeight: 0,
        }}>
          <div style={{ display: 'flex', flexShrink: 0, height: '62px' }}>
            <div style={{ width: `${FIRST_COL_W}px`, flexShrink: 0, background: HEADER_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Час</span>
            </div>
            {DAY_SHORT.map((dayName, idx) => (
              <div key={idx} style={{ flex: 1, minWidth: 0, background: HEADER_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: idx < 6 ? `1px solid ${BORDER}` : 'none' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em' }}>{dayName}</span>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {timeSlots.map((slot, rowIdx) => (
              <div
                key={slot}
                style={{
                  display: 'flex',
                  flex: 1,
                  minHeight: `${ROW_H}px`,
                  borderBottom: rowIdx < timeSlots.length - 1 ? `1px solid ${BORDER}` : 'none',
                  background: rowIdx % 2 === 0 ? ROW_A : ROW_B,
                }}
              >
                <div style={{ width: `${FIRST_COL_W}px`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${BORDER}`, padding: '6px' }}>
                  <div style={{
                    background: 'rgba(74, 106, 176, 0.35)',
                    color: TEXT_MAIN,
                    padding: '8px 12px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 800,
                    border: '1px solid rgba(255,255,255,0.12)',
                    lineHeight: 1.2,
                  }}>{slot}</div>
                </div>
                {weekDays.map((day, dayIdx) => {
                  const lesson = findLesson(day, slot)
                  return (
                    <div
                      key={dayIdx}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        justifyContent: 'center',
                        borderRight: dayIdx < 6 ? `1px solid ${BORDER}` : 'none',
                        padding: '10px 8px',
                        textAlign: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {lesson ? (
                        <div style={{ width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, minHeight: 0 }}>
                          <div style={cellLessonTitle}>{lesson.class_name}</div>
                          <div style={cellTrainerPill}>{lesson.trainer_name}</div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))}
            {timeSlots.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: '19px', fontStyle: 'italic' }}>
                Немає занять на цей тиждень
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: '14px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '13px', color: TEXT_MUTED, fontWeight: 600, letterSpacing: '0.03em' }}>Запис через посилання в профілі 🚀</div>
        </div>
      </div>
    </div>
  )
}

// ── Page: Admin Stats (Trainer Salary & Analytics) ──────────────────────────
function AdminStatsPage({ lessons, clients, trainers, plans }: {
  lessons: ActualLesson[],
  clients: Client[],
  trainers: string[],
  plans: SubscriptionPlan[]
}) {
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [expandedTrainer, setExpandedTrainer] = useState<string | null>(null)

  // Parse selected month range
  const monthStart = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }, [selectedMonth])
  const monthEnd = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    return new Date(y, m, 0, 23, 59, 59)
  }, [selectedMonth])

  // Filter lessons for the selected month that were booked (booked_count > 0)
  const monthLessons = useMemo(() => {
    return lessons.filter(l => {
      const t = l.start_timestamp.getTime()
      return t >= monthStart.getTime() && t <= monthEnd.getTime()
    })
  }, [lessons, monthStart, monthEnd])

  // Build a map: for each client, find their active subscription at the time of booking
  // We'll compute per-lesson revenue split for each trainer
  interface TrainerStats {
    trainerName: string
    totalLessons: number
    totalBookings: number
    singleVisitBookings: number
    subscriptionBookings: number
    trainerEarnings: number
    adminEarnings: number
    totalRevenue: number
    lessonDetails: {
      lessonId: string
      className: string
      date: Date
      bookedCount: number
      singleRevenue: number
      subRevenue: number
      trainerShare: number
      adminShare: number
    }[]
  }

  const trainerStatsMap = useMemo(() => {
    const statsMap = new Map<string, TrainerStats>()

    // Initialize all trainers
    trainers.forEach(name => {
      statsMap.set(name, {
        trainerName: name,
        totalLessons: 0,
        totalBookings: 0,
        singleVisitBookings: 0,
        subscriptionBookings: 0,
        trainerEarnings: 0,
        adminEarnings: 0,
        totalRevenue: 0,
        lessonDetails: []
      })
    })

    // Count subscription bookings per trainer from client data
    // Build a map of how many lessons each trainer had booked via subscription
    const subBookingsByTrainer = new Map<string, number>()
    clients.forEach(client => {
      client.bookings.forEach(booking => {
        const bookingDate = new Date(booking.date)
        if (bookingDate >= monthStart && bookingDate <= monthEnd) {
          const count = subBookingsByTrainer.get(booking.trainerName) || 0
          subBookingsByTrainer.set(booking.trainerName, count + 1)
        }
      })
    })

    monthLessons.forEach(lesson => {
      let stats = statsMap.get(lesson.trainer_name)
      if (!stats) {
        stats = {
          trainerName: lesson.trainer_name,
          totalLessons: 0,
          totalBookings: 0,
          singleVisitBookings: 0,
          subscriptionBookings: 0,
          trainerEarnings: 0,
          adminEarnings: 0,
          totalRevenue: 0,
          lessonDetails: []
        }
        statsMap.set(lesson.trainer_name, stats)
      }

      stats.totalLessons++
      const bookings = lesson.booked_count
      stats.totalBookings += bookings

      // Estimate: check how many bookings for this lesson were subscription-based
      // We use a heuristic: if the lesson is marked as booked by someone
      // who has an active subscription, it's a subscription booking
      // For simplicity, we count bookings from client records for that trainer in this month
      // and the rest are single visits
      const subBookingsForTrainer = subBookingsByTrainer.get(lesson.trainer_name) || 0
      
      // Distribute subscription bookings across lessons proportionally
      const trainerMonthLessons = monthLessons.filter(l => l.trainer_name === lesson.trainer_name)
      const subBookingsPerLesson = trainerMonthLessons.length > 0
        ? Math.floor(subBookingsForTrainer / trainerMonthLessons.length)
        : 0
      
      const subBookingsThisLesson = Math.min(subBookingsPerLesson, bookings)
      const singleBookingsThisLesson = Math.max(0, bookings - subBookingsThisLesson)

      stats.singleVisitBookings += singleBookingsThisLesson
      stats.subscriptionBookings += subBookingsThisLesson

      // Revenue calculation
      // Single visit: 300₴ total, 50% each
      const singleRevenue = singleBookingsThisLesson * SINGLE_VISIT_PRICE
      const singleTrainerShare = singleRevenue * 0.5
      const singleAdminShare = singleRevenue * 0.5

      // Subscription: (plan_price / duration_days) / 2 per booking
      // Find average plan price for estimation
      let subRevenue = 0
      let subTrainerShare = 0
      let subAdminShare = 0
      if (subBookingsThisLesson > 0 && plans.length > 0) {
        // Use a weighted average of plan prices
        const avgDailyRate = plans.reduce((sum, p) => sum + (p.price / p.duration_days), 0) / plans.length
        const perBookingRevenue = avgDailyRate // daily rate for one session day
        subRevenue = perBookingRevenue * subBookingsThisLesson
        subTrainerShare = subRevenue / 2
        subAdminShare = subRevenue / 2
      }

      const totalTrainerShare = singleTrainerShare + subTrainerShare
      const totalAdminShare = singleAdminShare + subAdminShare

      stats.trainerEarnings += totalTrainerShare
      stats.adminEarnings += totalAdminShare
      stats.totalRevenue += singleRevenue + subRevenue

      stats.lessonDetails.push({
        lessonId: lesson.id,
        className: lesson.class_name,
        date: lesson.start_timestamp,
        bookedCount: bookings,
        singleRevenue,
        subRevenue,
        trainerShare: totalTrainerShare,
        adminShare: totalAdminShare
      })
    })

    return statsMap
  }, [monthLessons, trainers, clients, plans, monthStart, monthEnd])

  const allStats = useMemo(() => Array.from(trainerStatsMap.values()).sort((a, b) => b.trainerEarnings - a.trainerEarnings), [trainerStatsMap])
  const totalAdminEarnings = useMemo(() => allStats.reduce((s, t) => s + t.adminEarnings, 0), [allStats])
  const totalTrainerPayout = useMemo(() => allStats.reduce((s, t) => s + t.trainerEarnings, 0), [allStats])
  const totalRevenue = useMemo(() => allStats.reduce((s, t) => s + t.totalRevenue, 0), [allStats])
  const totalBookings = useMemo(() => allStats.reduce((s, t) => s + t.totalBookings, 0), [allStats])

  const monthLabel = format(monthStart, 'LLLL yyyy', { locale: uk })

  return (
    <div className="container p-4 sm:p-8 max-w-6xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4">← Назад у меню</Button>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground"><BarChart3 className="w-6 h-6 text-brand-gold" /> Статистика та зарплати</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{monthLabel}</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className={cn(inputClasses, 'w-48 shadow-sm')}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-brand-navy to-brand-navy-dark text-primary-foreground overflow-hidden relative ring-1 ring-brand-gold/25">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-brand-gold" />
                </div>
                <span className="text-xs font-semibold text-brand-gold/90 uppercase tracking-wider">Загальний дохід</span>
              </div>
              <p className="text-2xl font-black">{Math.round(totalRevenue).toLocaleString('uk-UA')} ₴</p>
              <p className="text-xs text-white/70 mt-1">{totalBookings} бронювань</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-primary to-brand-navy text-primary-foreground overflow-hidden relative ring-1 ring-white/10">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-brand-gold" />
                </div>
                <span className="text-xs font-semibold text-white/85 uppercase tracking-wider">Дохід адміна</span>
              </div>
              <p className="text-2xl font-black text-brand-gold">{Math.round(totalAdminEarnings).toLocaleString('uk-UA')} ₴</p>
              <p className="text-xs text-white/70 mt-1">50% від усіх занять</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-secondary to-muted text-foreground overflow-hidden relative ring-1 ring-white/10">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5" />
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-brand-gold" />
                </div>
                <span className="text-xs font-semibold text-brand-gold/90 uppercase tracking-wider">Виплати тренерам</span>
              </div>
              <p className="text-2xl font-black">{Math.round(totalTrainerPayout).toLocaleString('uk-UA')} ₴</p>
              <p className="text-xs text-muted-foreground mt-1">{allStats.filter(s => s.totalBookings > 0).length} активних тренерів</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-brand-gold to-brand-gold-hover text-brand-charcoal overflow-hidden relative ring-1 ring-brand-gold/40">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-black/10" />
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-brand-charcoal/80 uppercase tracking-wider">Всього занять</span>
              </div>
              <p className="text-2xl font-black">{allStats.reduce((s, t) => s + t.totalLessons, 0)}</p>
              <p className="text-xs text-brand-charcoal/70 mt-1">за {monthLabel}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Salary Formula Explanation */}
      <Card className="mb-8 border-border bg-muted/40">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/20 text-brand-gold flex items-center justify-center shrink-0 mt-0.5">
              <Settings className="w-4 h-4" />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Формула розрахунку зарплати:</p>
              <p>• <b>Разове заняття ({SINGLE_VISIT_PRICE}₴):</b> 50% адмін ({SINGLE_VISIT_PRICE/2}₴) + 50% тренер ({SINGLE_VISIT_PRICE/2}₴)</p>
              <p>• <b>Абонемент:</b> (ціна абонементу ÷ к-сть днів) ÷ 2 — одна частина адміну, інша тренеру за кожне проведене заняття</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trainer Salary Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-brand-navy to-brand-navy-dark text-primary-foreground pb-4 border-b border-white/10">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-brand-gold" />
            Зарплати тренерів — <span className="capitalize text-brand-gold/95">{monthLabel}</span>
          </CardTitle>
          <CardDescription className="text-white/65 text-xs">Натисніть на тренера, щоб побачити деталі по кожному заняттю</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {allStats.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40 text-brand-gold" />
              <p>Немає даних за цей місяць</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {allStats.map((stats, idx) => {
                const isExpanded = expandedTrainer === stats.trainerName
                const hasData = stats.totalBookings > 0
                const maxEarnings = Math.max(...allStats.map(s => s.trainerEarnings), 1)
                const barWidth = (stats.trainerEarnings / maxEarnings) * 100

                return (
                  <motion.div
                    key={stats.trainerName}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <div
                      className={cn(
                        "p-5 cursor-pointer transition-colors",
                        isExpanded ? "bg-brand-gold/10" : "hover:bg-muted/60",
                        !hasData && "opacity-50"
                      )}
                      onClick={() => setExpandedTrainer(isExpanded ? null : stats.trainerName)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 shadow-sm",
                          idx === 0 && hasData ? "bg-gradient-to-br from-brand-gold to-brand-gold-light text-brand-charcoal" :
                          idx === 1 && hasData ? "bg-gradient-to-br from-primary to-brand-navy text-primary-foreground" :
                          idx === 2 && hasData ? "bg-gradient-to-br from-secondary to-muted text-foreground" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {stats.trainerName.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground">{stats.trainerName}</h3>
                            {idx === 0 && hasData && (
                              <Badge className="bg-brand-gold text-brand-charcoal border-0 text-[9px] px-1.5">Топ</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{stats.totalLessons} занять</span>
                            <span>{stats.totalBookings} бронювань</span>
                            <span className="text-primary">{stats.singleVisitBookings} разових</span>
                            <span className="text-brand-gold">{stats.subscriptionBookings} абонемент</span>
                          </div>
                          {/* Earnings bar */}
                          {hasData && (
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${barWidth}%` }}
                                  transition={{ duration: 0.6, delay: idx * 0.05 }}
                                  className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Salary Amount */}
                        <div className="text-right shrink-0">
                          <p className="text-xl font-black text-brand-gold">{Math.round(stats.trainerEarnings).toLocaleString('uk-UA')} ₴</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">зарплата тренера</p>
                        </div>

                        {/* Expand Arrow */}
                        <ChevronRight className={cn("w-5 h-5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-90 text-brand-gold")} />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-2 bg-muted/50">
                            {/* Summary row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                              <div className="p-3 bg-card rounded-xl border border-border text-center">
                                <p className="text-lg font-black text-brand-gold">{Math.round(stats.trainerEarnings).toLocaleString('uk-UA')}₴</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Тренер</p>
                              </div>
                              <div className="p-3 bg-card rounded-xl border border-border text-center">
                                <p className="text-lg font-black text-brand-gold">{Math.round(stats.adminEarnings).toLocaleString('uk-UA')}₴</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Адмін</p>
                              </div>
                              <div className="p-3 bg-card rounded-xl border border-border text-center">
                                <p className="text-lg font-black text-foreground">{Math.round(stats.totalRevenue).toLocaleString('uk-UA')}₴</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Всього</p>
                              </div>
                              <div className="p-3 bg-card rounded-xl border border-border text-center">
                                <p className="text-lg font-black text-primary">{stats.totalBookings}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Бронювань</p>
                              </div>
                            </div>

                            {/* Detail Table */}
                            {stats.lessonDetails.length > 0 && (
                              <div className="rounded-xl overflow-hidden border border-border">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted text-muted-foreground text-xs">
                                      <th className="text-left p-3 font-semibold">Заняття</th>
                                      <th className="text-center p-3 font-semibold">Дата</th>
                                      <th className="text-center p-3 font-semibold">Записи</th>
                                      <th className="text-right p-3 font-semibold">Тренер</th>
                                      <th className="text-right p-3 font-semibold">Адмін</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-card divide-y divide-border">
                                    {stats.lessonDetails.map(detail => (
                                      <tr key={detail.lessonId} className="hover:bg-muted/40 transition-colors">
                                        <td className="p-3 font-semibold text-foreground">{detail.className}</td>
                                        <td className="p-3 text-center text-muted-foreground text-xs">{format(detail.date, 'dd.MM HH:mm')}</td>
                                        <td className="p-3 text-center">
                                          <Badge variant="outline" className="text-[10px]">{detail.bookedCount}</Badge>
                                        </td>
                                        <td className="p-3 text-right font-bold text-brand-gold">{Math.round(detail.trainerShare)}₴</td>
                                        <td className="p-3 text-right font-bold text-brand-gold">{Math.round(detail.adminShare)}₴</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Page: Admin Schedule Builder ─────────────────────────────────────────────
function AdminSchedulePage({ lessons, setLessons, trainers, classTypes }: { lessons: ActualLesson[], setLessons: React.Dispatch<React.SetStateAction<ActualLesson[]>>, trainers: string[], classTypes: string[] }) {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isExporting, setIsExporting] = useState(false)

  const [targetDateForNewLesson, setTargetDateForNewLesson] = useState<Date>(new Date())
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false)
  const [newLessonName, setNewLessonName] = useState(classTypes[0] || 'Тренування')
  const [newLessonTrainer, setNewLessonTrainer] = useState(trainers[0] || 'Тренер')
  const [newLessonTime, setNewLessonTime] = useState('18:00')

  const actDate = selectedDate || new Date()
  const weekStart = startOfWeek(actDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(actDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weeklyLessons = lessons.filter(l => l.start_timestamp >= weekStart && l.start_timestamp <= weekEnd)

  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault()
    const [h,m] = newLessonTime.split(':').map(Number)
    const newLesson: ActualLesson = {
      id: Math.random().toString(), class_name: newLessonName, trainer_name: newLessonTrainer,
      start_timestamp: makeDate(targetDateForNewLesson, h, m), end_timestamp: makeDate(targetDateForNewLesson, h+1, m),
      capacity: 10, booked_count: 0, status: 'SCHEDULED'
    }
    setLessons(p => [...p, newLesson].sort((a,b)=>a.start_timestamp.getTime()-b.start_timestamp.getTime()))
    setIsAddLessonOpen(false)
  }

  const handleExportPhoto = async () => {
    const el = document.getElementById('printable-schedule')
    if (!el) return
    setIsExporting(true)
    try {
      const dataUrl = await domtoimage.toPng(el, {
        width: 1080, height: 1080,
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      })
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `Timetable_${format(weekStart, 'dd-MM')}_${format(weekEnd, 'dd-MM')}.png`
      link.href = blobUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch(e) {
      console.error(e)
      alert("Не вдалось згенерувати фото. Перевірте консоль (F12).")
    }
    setIsExporting(false)
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8">
      <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4 self-start">← Назад у меню</Button>

      <SocialMediaPoster lessons={weeklyLessons} weekStart={weekStart} weekEnd={weekEnd} />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground"><CalendarIcon className="w-6 h-6 text-brand-gold"/> Тижневий білдер</h1>
          <p className="text-sm text-muted-foreground">Створюйте та модифікуйте графік на весь тиждень</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input type="date" className={cn(inputClasses, "w-44 shadow-sm")} value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''} onChange={e => setSelectedDate(new Date(e.target.value))} />
          <Button onClick={handleExportPhoto} disabled={isExporting} variant="brand" className="w-full sm:w-auto">
            <Camera className="w-4 h-4 mr-2" />
            {isExporting ? 'Генерується...' : 'Згенерувати фото (Instagram)'}
          </Button>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 flex-1">
        {weekDays.map(day => {
          const isTodayLoc = isSameDay(day, new Date())
          const dayLessons = weeklyLessons.filter(l => isSameDay(l.start_timestamp, day)).sort((a,b)=>a.start_timestamp.getTime()-b.start_timestamp.getTime())
          return (
            <Card key={day.toISOString()} className={cn("flex flex-col border-none shadow-sm h-full", isTodayLoc ? "ring-2 ring-brand-gold" : "border border-border/80")}>
              <CardHeader className="bg-muted/50 p-3 pb-2 text-center border-b border-border/70 rounded-t-xl shrink-0">
                 <p className="text-sm font-bold uppercase text-muted-foreground">{format(day, 'EEEE', {locale: uk})}</p>
                 <p className={cn("text-xs", isTodayLoc ? "text-brand-gold font-bold" : "text-muted-foreground/90")}>{format(day, 'dd MMMM', {locale: uk})}</p>
              </CardHeader>
              <CardContent className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto min-h-[300px]">
                {dayLessons.map(l => (
                  <div key={l.id} className="p-2 rounded-lg border border-border bg-card text-xs hover:border-brand-gold/50 transition-colors group relative">
                    <p className="font-bold text-foreground leading-tight">{l.class_name}</p>
                    <p className="text-muted-foreground mt-1 font-medium">{format(l.start_timestamp, 'HH:mm')} - {format(l.end_timestamp, 'HH:mm')}</p>
                    <p className="text-muted-foreground/90 mt-0.5">{l.trainer_name}</p>
                    <button onClick={() => { if(confirm('Видалити заняття?')) setLessons(p=>p.filter(x=>x.id!==l.id)) }} className="absolute top-1 right-1 w-5 h-5 rounded-md bg-red-950/60 text-red-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <div className="mt-auto pt-2">
                  <Button variant="ghost" className="w-full h-8 text-xs border border-dashed border-border text-muted-foreground hover:text-brand-gold hover:bg-brand-gold/10 hover:border-brand-gold/40"
                    onClick={() => {
                       setTargetDateForNewLesson(day);
                       setNewLessonName(classTypes[0] || '');
                       setNewLessonTrainer(trainers[0] || '');
                       setIsAddLessonOpen(true)
                    }}>
                    <Plus className="w-3 h-3 mr-1" /> Додати
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialog for Adding class */}
      <Dialog open={isAddLessonOpen} onOpenChange={setIsAddLessonOpen}>
        <DialogContent>
          <form onSubmit={handleAddLesson} className="space-y-4">
            <div>
              <p className="font-bold text-lg">Нове заняття</p>
              <p className="text-sm text-muted-foreground">На дату: {format(targetDateForNewLesson, 'dd MMMM yyyy', {locale: uk})}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Назва заняття</label>
              {classTypes.length > 0 ? (
                <select required value={newLessonName} onChange={e=>setNewLessonName(e.target.value)} className={inputClasses}>
                  {classTypes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input required placeholder="Спочатку додайте формати в Налаштуваннях" value={newLessonName} onChange={e=>setNewLessonName(e.target.value)} className={inputClasses} />
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Час початку</label>
              <input required type="time" value={newLessonTime} onChange={e=>setNewLessonTime(e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label className="text-sm font-medium">Тренер</label>
              {trainers.length > 0 ? (
                <select required value={newLessonTrainer} onChange={e=>setNewLessonTrainer(e.target.value)} className={inputClasses}>
                  {trainers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <input required placeholder="Спочатку додайте тренерів в Налаштуваннях" value={newLessonTrainer} onChange={e=>setNewLessonTrainer(e.target.value)} className={inputClasses} />
              )}
            </div>
            <Button type="submit" variant="brand" className="w-full">Створити заняття</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── App Init ────────────────────────────────────────────────────────────────
export default function App() {
  const [lessons, setLessons] = usePersistentState<ActualLesson[]>('titan_lessons', [
    { id: '1', class_name: 'Stretching', trainer_name: 'Олена Петренко', start_timestamp: makeDate(new Date(), 9, 0), end_timestamp: makeDate(new Date(), 10, 0), capacity: 10, booked_count: 5, status: 'SCHEDULED' },
    { id: '2', class_name: 'Yoga', trainer_name: 'Alex Johnson', start_timestamp: makeDate(new Date(), 19, 0), end_timestamp: makeDate(new Date(), 20, 0), capacity: 15, booked_count: 15, status: 'SCHEDULED', is_booked_by_me: true, my_booking_email: 'test@example.com' }
  ], dateReviver)

  const [trainers, setTrainers] = usePersistentState<string[]>('titan_trainers', ['Alex Johnson', 'Sarah Smith', 'Mike Tyson', 'Олена Петренко', 'Дмитро Ковтун'])
  const [classTypes, setClassTypes] = usePersistentState<string[]>('titan_classes', ['Yoga', 'Stretching', 'Crossfit Basics', 'Тайський бокс', 'Pilates 2.0'])
  const [isAdminLogged, setIsAdminLogged] = usePersistentState<boolean>('titan_admin', false)

  // ── Subscription Plans (Admin-managed) ──
  const [plans, setPlans] = usePersistentState<SubscriptionPlan[]>('brave_plans', DEFAULT_PLANS)

  // ── Promo Codes (Admin-generated) ──
  const [promoCodes, setPromoCodes] = usePersistentState<PromoCode[]>('brave_promo_codes', [])

  // ── Client Auth & Data ──
  const [clients, setClients] = usePersistentState<Client[]>('brave_clients', [])
  const [currentClientId, setCurrentClientId] = usePersistentState<string | null>('brave_current_client', null)

  const currentClient = useMemo(() =>
    clients.find(c => c.id === currentClientId) || null
  , [clients, currentClientId])

  // Restore Supabase session on page reload
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const uid = session.user.id
        // If no local client record yet, fetch from Supabase User table
        if (!clients.find(c => c.id === uid)) {
          const { data: profile } = await supabase.from('User').select('*').eq('id', uid).single()
          if (profile) {
            const restoredClient: Client = { id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, password: '', subscriptions: [], bookings: [] }
            setClients(prev => {
              if (prev.find(c => c.id === uid)) return prev
              return [...prev, restoredClient]
            })
          }
        }
        setCurrentClientId(uid)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClientLogout = async () => {
    await supabase.auth.signOut()
    setCurrentClientId(null)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientPage lessons={lessons} setLessons={setLessons} currentClient={currentClient} onClientLogout={handleClientLogout} />} />
        <Route path="/book/:id" element={<BookingPage lessons={lessons} setLessons={setLessons} currentClient={currentClient} setClients={setClients} plans={plans} onClientLogout={handleClientLogout} />} />
        <Route path="/cancel/:id" element={<CancelBookingPage lessons={lessons} setLessons={setLessons} />} />
        <Route path="/auth" element={<AuthPage clients={clients} setClients={setClients} setCurrentClientId={setCurrentClientId} />} />
        <Route path="/dashboard" element={<ClientDashboardPage currentClient={currentClient} setClients={setClients} onClientLogout={handleClientLogout} plans={plans} promoCodes={promoCodes} setPromoCodes={setPromoCodes} />} />

        {/* Admin Section */}
        <Route path="/admin" element={<AdminLayout isAdminLogged={isAdminLogged} setIsAdminLogged={setIsAdminLogged} />}>
          <Route index element={<AdminHub />} />
          <Route path="schedule" element={<AdminSchedulePage lessons={lessons} setLessons={setLessons} trainers={trainers} classTypes={classTypes} />} />
          <Route path="settings" element={<AdminSettingsPage trainers={trainers} setTrainers={setTrainers} classTypes={classTypes} setClassTypes={setClassTypes} plans={plans} setPlans={setPlans} promoCodes={promoCodes} setPromoCodes={setPromoCodes} />} />
          <Route path="stats" element={<AdminStatsPage lessons={lessons} clients={clients} trainers={trainers} plans={plans} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
