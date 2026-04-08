import { useState, useMemo, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
// @ts-ignore
import domtoimage from 'dom-to-image-more'
import {
  Calendar as CalendarIcon, Clock, Users, ShieldAlert, User,
  AlertTriangle, X, LogOut, Phone, Camera, Plus, Database, Settings
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

const makeDate = (baseDate: Date, h: number, m: number): Date => {
  const d = new Date(baseDate)
  d.setHours(h, m, 0, 0)
  return d
}

const inputClasses = "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

// ── Shared Header ──────────────────────────────────────────────────────────
function Header({ role, onLogout }: { role: 'CLIENT'|'ADMIN'|'TRAINER', onLogout?: () => void }) {
  const roleColors = {
    CLIENT:  'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    TRAINER: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    ADMIN:   'bg-purple-500/10 text-purple-600 border-purple-500/30',
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-gray-200 shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-8">
        <Link to={role === 'ADMIN' ? '/admin' : '/'} className="flex gap-2.5 items-center">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow">
            <CalendarIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 flex items-baseline gap-1">
            <span className="italic font-serif">Brave!</span> <span className="text-slate-500 font-medium">Yoga</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className={cn('uppercase tracking-widest text-[9px] px-2 py-0.5 shadow-sm', roleColors[role])}>
            {role}
          </Badge>
          {onLogout && (
            <Button variant="ghost" size="icon" onClick={onLogout} className="text-slate-500 ring-1 ring-slate-200 rounded-full hover:bg-red-50 hover:text-red-600 hover:ring-red-200">
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Page: Client Home (Public) ──────────────────────────────────────────────
function ClientPage({ lessons, setLessons }: { lessons: ActualLesson[], setLessons: React.Dispatch<React.SetStateAction<ActualLesson[]>> }) {
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
    setCancelBlocked(hoursLeft < 12)
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

  return (
    <div className="min-h-screen bg-[#f9f9fb] font-sans text-foreground">
      <Header role="CLIENT" />
      <main className="container px-4 sm:px-8 pt-10 pb-24 grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 lg:col-span-3 space-y-5">
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Оберіть дату</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 px-2">
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="mx-auto" />
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-8 lg:col-span-9 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Розклад занять</h2>
            <p className="text-sm text-slate-500 mt-0.5">{selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy') : 'Оберіть дату'}</p>
          </div>

          <div className="grid gap-3">
            <AnimatePresence>
              {filteredLessons.map((lesson, idx) => {
                const isFull = lesson.booked_count >= lesson.capacity

                return (
                  <motion.div key={lesson.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.3 }}>
                    <Card className={cn("bg-white border shadow-sm overflow-hidden", lesson.is_booked_by_me ? "border-emerald-200" : "border-gray-200")}>
                      <div className={cn("h-1 w-full", lesson.is_booked_by_me ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-slate-300 to-slate-400")} />
                      <div className="p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
                        <div className="space-y-2.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{lesson.class_name}</h3>
                            {lesson.is_booked_by_me && <Badge className="bg-emerald-500 text-white border-0 text-[10px] px-2">Ви записані</Badge>}
                            {isFull && !lesson.is_booked_by_me && <Badge variant="destructive" className="text-[10px] px-2">Місць немає</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{format(lesson.start_timestamp, 'HH:mm')} – {format(lesson.end_timestamp, 'HH:mm')}</span>
                            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{lesson.trainer_name}</span>
                            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{lesson.booked_count} / {lesson.capacity} місць</span>
                          </div>
                        </div>
                        <div className="w-full sm:w-auto shrink-0 flex gap-2">
                          {!lesson.is_booked_by_me ? (
                            <Button size="sm" disabled={isFull} onClick={() => navigate(`/book/${lesson.id}`)} className="w-full sm:w-28 bg-slate-900 hover:bg-slate-800 text-white">
                              Записатись
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openCancelDialog(lesson)} className="w-full sm:w-28 border-red-200 text-red-600 hover:bg-red-50">
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
              <div className="py-24 text-center text-slate-400 border border-dashed border-gray-200 rounded-xl bg-white/50">
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
               <p className="text-sm text-red-700 bg-red-50 p-4 rounded-xl border border-red-100">Скасування неможливе — до початку заняття залишилось менше 12 годин.</p>
             ) : (
               <p className="text-sm text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-100">Більше ніж 12 годин. Буде ініційовано повернення коштів (Refund).</p>
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

// ── Page: Booking Form ──────────────────────────────────────────────────────
function BookingPage({ lessons, setLessons }: { lessons: ActualLesson[], setLessons: React.Dispatch<React.SetStateAction<ActualLesson[]>> }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const lesson = lessons.find(l => l.id === id)
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  if (!lesson) {
    return <div className="p-8 text-center">Заняття не знайдено <br/><Button onClick={()=>navigate('/')} className="mt-4">Назад</Button></div>
  }

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    
    try {
      await fetch('http://localhost:3000/api/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          clientName: name || 'Гість',
          className: lesson.class_name,
          startTime: format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk}),
          trainerName: lesson.trainer_name,
          lessonId: lesson.id
        })
      });
    } catch(e) { console.error(e) }

    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_booked_by_me: true, booked_count: l.booked_count + 1, my_booking_name: name, my_booking_email: email } : l))
    setIsProcessing(false)
    setIsSuccess(true)
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#f9f9fb] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="shadow-xl border-emerald-100 bg-white text-center">
            <CardContent className="pt-10 pb-8 px-6 space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Успішно заброньовано!</h2>
                <p className="text-slate-500">Час заняття: {format(lesson.start_timestamp, 'HH:mm')}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-left">
                <p className="text-sm font-semibold text-emerald-900 mb-1">📩 Лист відправлено на пошту!</p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Ми надіслали підтвердження на <b>{email}</b>.<br/><br/>
                  У листі ви знайдете всю інформацію про заняття та посилання для скасування запису, якщо ваші плани зміняться.
                </p>
              </div>
              <Button className="w-full mt-4" onClick={() => navigate('/')}>Перейти до розкладу</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9f9fb] font-sans flex flex-col">
      <Header role="CLIENT" />
      <main className="flex-1 container max-w-lg mx-auto p-4 sm:p-8 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
          <Card className="shadow-lg border-gray-200">
            <CardHeader className="pb-4 border-b border-gray-100 bg-slate-50/50 rounded-t-xl">
               <Button variant="ghost" className="w-fit p-0 h-auto mb-2 text-slate-500 hover:bg-transparent hover:text-slate-800" onClick={()=>navigate('/')}>← Назад до розкладу</Button>
               <CardTitle className="text-2xl font-bold">Оформлення заявки</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 mb-6">
                <p className="font-semibold text-slate-900 text-base">{lesson.class_name}</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk})}</span>
                  <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{lesson.trainer_name}</span>
                </div>
              </div>
              <form onSubmit={handleBook} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Ваше ім'я</label>
                  <input required placeholder="Іван Іванов" value={name} onChange={e=>setName(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Номер телефону</label>
                  <input required type="tel" placeholder="+380 99 000 00 00" value={phone} onChange={e=>setPhone(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> Email для підтвердження</label>
                  <input required type="email" placeholder="ivan@example.com" value={email} onChange={e=>setEmail(e.target.value)} className={inputClasses} />
                </div>
                <Button type="submit" disabled={isProcessing} className="w-full h-11 mt-4 bg-slate-900 text-white text-base">
                  {isProcessing ? 'Обробка...' : 'Сплатити та записатись'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}

// ── Page: Cancel Booking from Email (Link simulation) ───────────────────────
function CancelBookingPage({ lessons, setLessons }: { lessons: ActualLesson[], setLessons: React.Dispatch<React.SetStateAction<ActualLesson[]>> }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const lesson = lessons.find(l => l.id === id && l.is_booked_by_me)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)

  if (!lesson && !isCancelled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
        <div>
          <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Бронювання не знайдено</h2>
          <p className="text-slate-500 mb-6">Можливо, воно вже було скасовано або посилання застаріло.</p>
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
          email: lesson.my_booking_email,
          clientName: lesson.my_booking_name || 'Гість',
          className: lesson.class_name,
          startTime: format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk})
        })
      });
    } catch(e) { console.error(e) }

    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_booked_by_me: false, booked_count: l.booked_count - 1 } : l))
    setIsProcessing(false)
    setIsCancelled(true)
  }

  if (isCancelled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
           <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
             <X className="w-8 h-8" />
           </div>
           <h2 className="text-2xl font-bold text-slate-900 mb-2">Запис успішно скасовано</h2>
           <p className="text-slate-500 mb-6">Ваше місце звільнено.</p>
           <Button onClick={() => navigate('/')}>Повернутись до розкладу</Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm">
        <Card className="shadow-lg border-red-100">
          <CardHeader className="text-center border-b border-slate-100 bg-white rounded-t-xl pb-6">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">Скасування запису</CardTitle>
            <p className="text-sm text-slate-500 mt-2">Ви дійсно бажаєте скасувати свій запис?</p>
          </CardHeader>
          <CardContent className="pt-6 bg-slate-50/50">
            <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 space-y-2">
              <p className="font-bold text-slate-900">{lesson?.class_name}</p>
              <p className="text-sm text-slate-500">{lesson ? format(lesson.start_timestamp, 'd MMMM, HH:mm', {locale: uk}) : ''}</p>
              <p className="text-sm text-slate-500">{lesson?.trainer_name}</p>
              <hr className="my-2" />
              <p className="text-xs text-slate-400">Пошта: {lesson?.my_booking_email}</p>
            </div>
            <Button variant="destructive" className="w-full h-11 text-base font-semibold" disabled={isProcessing} onClick={handleCancelClick}>
              {isProcessing ? 'Скасування...' : 'Так, скасувати запис'}
            </Button>
            <Button variant="ghost" className="w-full mt-2 text-slate-500" disabled={isProcessing} onClick={() => navigate('/')}>
              Повернутись
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ── Admin Layout & Login ────────────────────────────────────────────────────
function AdminLayout({ isAdminLogged, setIsAdminLogged }: { isAdminLogged: boolean, setIsAdminLogged: (b: boolean) => void }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')

  if (!isAdminLogged) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2"><ShieldAlert className="w-6 h-6 text-purple-600"/></div>
            <CardTitle className="text-center">Вхід для Адміністратора</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => { e.preventDefault(); if(password==='admin123') setIsAdminLogged(true); else alert('Невірно!') }}>
              <input type="password" required placeholder="Секретний пароль (admin123)" value={password} onChange={e=>setPassword(e.target.value)} className={inputClasses} />
              <Button type="submit" className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white">Увійти</Button>
              <Button type="button" variant="link" onClick={()=>navigate('/')} className="w-full mt-2 text-slate-400">На головну</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
      <h1 className="text-3xl font-bold mb-8 text-slate-800">Меню Адміністратора</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Card className="cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group" onClick={() => navigate('/admin/schedule')}>
          <CardContent className="flex flex-col items-center p-10 text-center gap-4">
             <div className="w-20 h-20 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
               <CalendarIcon className="w-10 h-10" />
             </div>
             <div>
               <h2 className="text-xl font-bold">Розклад занять</h2>
               <p className="text-sm text-slate-500 mt-2">Редагування тижневого графіку, скасування занять, генерація фото для соцмереж.</p>
             </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group" onClick={() => navigate('/admin/settings')}>
          <CardContent className="flex flex-col items-center p-10 text-center gap-4">
             <div className="w-20 h-20 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
               <Database className="w-10 h-10" />
             </div>
             <div>
               <h2 className="text-xl font-bold">База Даних</h2>
               <p className="text-sm text-slate-500 mt-2">Додавання і видалення тренерів та нових форматів занять.</p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Page: Admin Settings (Manage Trainers & Classes) ────────────────────────
function AdminSettingsPage({ trainers, setTrainers, classTypes, setClassTypes }: { 
  trainers: string[], setTrainers: React.Dispatch<React.SetStateAction<string[]>>,
  classTypes: string[], setClassTypes: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const [newTrainer, setNewTrainer] = useState('')
  const [newClass, setNewClass] = useState('')
  const navigate = useNavigate()

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

  return (
    <div className="container p-4 sm:p-8 max-w-5xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4">← Назад у меню</Button>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-blue-600" /> Налаштування Бази</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Trainers Panel */}
        <Card>
          <CardHeader className="bg-blue-50/50 pb-4 border-b mb-4">
            <CardTitle>Список Тренерів</CardTitle>
            <CardDescription>Ці тренери будуть доступні у вигляді випадаючого списку при створенні графіка.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddTrainer} className="flex gap-2">
               <input required placeholder="Ім'я тренера (напр. Ніна Кравіц)" value={newTrainer} onChange={e=>setNewTrainer(e.target.value)} className={inputClasses} />
               <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"><Plus className="w-4 h-4 mr-1"/> Додати</Button>
            </form>
            <div className="space-y-2">
              {trainers.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">{t}</span>
                  <button onClick={() => { if(confirm('Видалити?')) setTrainers(p => p.filter(x => x !== t)) }} className="text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded text-xs transition-colors">Видалити</button>
                </div>
              ))}
              {trainers.length === 0 && <p className="text-sm text-slate-400 italic">Схоже, у вас немає жодного тренера. Додайте!</p>}
            </div>
          </CardContent>
        </Card>

        {/* Classes Panel */}
        <Card>
          <CardHeader className="bg-purple-50/50 pb-4 border-b mb-4">
            <CardTitle>Типи Занять</CardTitle>
            <CardDescription>Вкажіть назви занять, які проходять у вашому спортзалі.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddClass} className="flex gap-2">
               <input required placeholder="Назва заняття (напр. Йога)" value={newClass} onChange={e=>setNewClass(e.target.value)} className={inputClasses} />
               <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"><Plus className="w-4 h-4 mr-1"/> Додати</Button>
            </form>
            <div className="space-y-2">
              {classTypes.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">{c}</span>
                  <button onClick={() => { if(confirm('Видалити?')) setClassTypes(p => p.filter(x => x !== c)) }} className="text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded text-xs transition-colors">Видалити</button>
                </div>
              ))}
              {classTypes.length === 0 && <p className="text-sm text-slate-400 italic">Жодного заняття не збережено.</p>}
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

  // Collect unique time slots from all lessons this week, sorted
  const timeSlots: string[] = []
  const timeSlotsSet = new Set<string>()
  lessons.forEach(l => {
    const key = format(l.start_timestamp, 'HH:mm')
    if (!timeSlotsSet.has(key)) { timeSlotsSet.add(key); timeSlots.push(key) }
  })
  timeSlots.sort()

  // Helper: find lesson for a given day + time slot
  const findLesson = (day: Date, timeSlot: string): ActualLesson | undefined => {
    return lessons.find(l => isSameDay(l.start_timestamp, day) && format(l.start_timestamp, 'HH:mm') === timeSlot)
  }

  // Layout constants
  const CANVAS = 1080
  const PAD = 40
  const HEADER_HEIGHT = 130
  const COL_HEADER_H = 56
  const FIRST_COL_W = 100
  const TABLE_TOP = HEADER_HEIGHT + 10
  const TABLE_BODY_H = CANVAS - TABLE_TOP - PAD - COL_HEADER_H - 10
  const ROW_H = timeSlots.length > 0 ? Math.min(Math.floor(TABLE_BODY_H / timeSlots.length), 120) : 80

  // Colors
  const GOLD = '#DDA343' // Deeper yellow/gold matching the image
  const TEXT_DARK = '#2C3E50'
  const BORDER = '#2C3E50' // Dark blue/grey matching the image's grid lines

  return (
    <div style={{ position: 'fixed', top: '-99999px', left: '-99999px', width: `${CANVAS}px`, height: `${CANVAS}px` }}>
      <div
        id="printable-schedule"
        style={{
          width: `${CANVAS}px`,
          height: `${CANVAS}px`,
          background: 'radial-gradient(circle at 10% 10%, #ffffff 0%, #F7F3EB 100%)',
          color: TEXT_DARK,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
          overflow: 'hidden',
          boxSizing: 'border-box',
          padding: '40px 48px',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          #printable-schedule * { border-style: none; border-width: 0; outline: none; }
        `}} />
        
        {/* ── HEADER / STUDIO NAME ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px', flexShrink: 0, height: '110px',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center',
            marginBottom: '4px'
          }}>
            <span style={{ 
              fontSize: '60px', fontStyle: 'italic', fontWeight: 600, 
              fontFamily: '"Georgia", "Times New Roman", serif', 
              color: TEXT_DARK, marginRight: '16px', 
              letterSpacing: '-1px'
            }}>Brave!</span>
            <span style={{ 
              fontSize: '56px', fontWeight: 900, 
              fontFamily: '"Inter", system-ui, sans-serif', 
              letterSpacing: '-0.03em', color: TEXT_DARK 
            }}>Yoga</span>
          </div>
          <div style={{
            background: 'rgba(221,163,67,0.1)',
            padding: '6px 20px', borderRadius: '99px',
            fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', color: '#B48228',
            textTransform: 'uppercase', marginTop: '6px', textAlign: 'center',
          }}>
            {format(weekStart, 'dd.MM')} — {format(weekEnd, 'dd.MM.yyyy')}
          </div>
        </div>

        {/* ── TABLE ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          borderRadius: '24px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.05)',
          overflow: 'hidden',
          background: 'white',
        }}>
          {/* Column Headers Row */}
          <div style={{ display: 'flex', flexShrink: 0, height: '64px' }}>
            {/* "Час" header cell */}
            <div style={{
              width: `${FIRST_COL_W}px`, flexShrink: 0,
              background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRight: '1px solid rgba(255,255,255,0.1)',
            }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: GOLD, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Час</span>
            </div>
            {/* Day header cells */}
            {DAY_SHORT.map((dayName, idx) => (
              <div key={idx} style={{
                flex: 1,
                background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: idx < 6 ? '1px solid rgba(255,255,255,0.1)' : 'none',
              }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: 'white', letterSpacing: '0.05em' }}>{dayName}</span>
              </div>
            ))}
          </div>

          {/* Data Rows */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {timeSlots.map((slot, rowIdx) => (
              <div key={slot} style={{
                display: 'flex', flex: 1,
                borderBottom: rowIdx < timeSlots.length - 1 ? '1px solid #F1F5F9' : 'none',
                minHeight: `${ROW_H}px`,
                background: rowIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
              }}>
                {/* Time slot cell */}
                <div style={{
                  width: `${FIRST_COL_W}px`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRight: '1px solid #F1F5F9',
                  padding: '4px',
                }}>
                  <div style={{
                    background: '#F1F5F9', color: '#334155',
                    padding: '6px 12px', borderRadius: '12px',
                    fontSize: '16px', fontWeight: 800,
                  }}>
                    {slot}
                  </div>
                </div>
                {/* Day cells */}
                {weekDays.map((day, dayIdx) => {
                  const lesson = findLesson(day, slot)
                  return (
                    <div key={dayIdx} style={{
                      flex: 1,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      borderRight: dayIdx < 6 ? '1px solid #F1F5F9' : 'none',
                      padding: '10px 6px',
                      textAlign: 'center',
                    }}>
                      {lesson ? (
                        <>
                          <div style={{
                            fontSize: '15px', fontWeight: 800, color: '#0F172A',
                            lineHeight: 1.2, marginBottom: '5px', letterSpacing: '-0.01em',
                          }}>
                            {lesson.class_name}
                          </div>
                          <div style={{
                            fontSize: '12px', fontWeight: 600, color: '#64748B',
                            lineHeight: 1.2, backgroundColor: 'rgba(100,116,139,0.08)',
                            padding: '3px 8px', borderRadius: '6px'
                          }}>
                            {lesson.trainer_name}
                          </div>
                        </>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))}
            {timeSlots.length === 0 && (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#CBD5E1', fontSize: '20px', fontStyle: 'italic',
              }}>
                Немає занять на цей тиждень
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          marginTop: '16px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0.8,
        }}>
          <div style={{ fontSize: '14px', color: '#64748B', fontWeight: 600, letterSpacing: '0.02em' }}>Запис через посилання в профілі 🚀</div>
        </div>
      </div>
    </div>
  )
}

// ── Page: Admin Schedule Builder ─────────────────────────────────────────────
function AdminSchedulePage({ lessons, setLessons, trainers, classTypes }: { lessons: ActualLesson[], setLessons: React.Dispatch<React.SetStateAction<ActualLesson[]>>, trainers: string[], classTypes: string[] }) {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isExporting, setIsExporting] = useState(false)

  // Modals
  const [targetDateForNewLesson, setTargetDateForNewLesson] = useState<Date>(new Date())
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false)
  const [newLessonName, setNewLessonName] = useState(classTypes[0] || 'Тренування')
  const [newLessonTrainer, setNewLessonTrainer] = useState(trainers[0] || 'Тренер')
  const [newLessonTime, setNewLessonTime] = useState('18:00')

  // Week Logic
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
        width: 1080,
        height: 1080,
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      })
      
      // Convert data URL to Blob to avoid browser UUID naming issues
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.download = `Timetable_${format(weekStart, 'dd-MM')}_${format(weekEnd, 'dd-MM')}.png`
      link.href = blobUrl
      // Append to body is required by some browsers to respect the 'download' attribute
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

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarIcon className="w-6 h-6 text-purple-600"/> Тижневий білдер</h1>
          <p className="text-sm text-slate-500">Створюйте та модифікуйте графік на весь тиждень</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input type="date" className={cn(inputClasses, "w-44 bg-white shadow-sm")} value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''} onChange={e => setSelectedDate(new Date(e.target.value))} />
          <Button onClick={handleExportPhoto} disabled={isExporting} className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto">
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
            <Card key={day.toISOString()} className={cn("flex flex-col border-none shadow-sm h-full", isTodayLoc ? "ring-2 ring-purple-500" : "border border-gray-200")}>
              <CardHeader className="bg-slate-100/50 p-3 pb-2 text-center border-b border-gray-100 rounded-t-xl shrink-0">
                 <p className="text-sm font-bold uppercase text-slate-600">{format(day, 'EEEE', {locale: uk})}</p>
                 <p className={cn("text-xs", isTodayLoc ? "text-purple-600 font-bold" : "text-slate-400")}>{format(day, 'dd MMMM', {locale: uk})}</p>
              </CardHeader>
              <CardContent className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto min-h-[300px]">
                {dayLessons.map(l => (
                  <div key={l.id} className="p-2 rounded-lg border border-slate-200 bg-white text-xs hover:border-purple-300 transition-colors group relative">
                    <p className="font-bold text-slate-800 leading-tight">{l.class_name}</p>
                    <p className="text-slate-500 mt-1 font-medium">{format(l.start_timestamp, 'HH:mm')} - {format(l.end_timestamp, 'HH:mm')}</p>
                    <p className="text-slate-400 mt-0.5">{l.trainer_name}</p>
                    <button onClick={() => { if(confirm('Видалити заняття?')) setLessons(p=>p.filter(x=>x.id!==l.id)) }} className="absolute top-1 right-1 w-5 h-5 rounded-md bg-red-50 text-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                
                <div className="mt-auto pt-2">
                  <Button variant="ghost" className="w-full h-8 text-xs border border-dashed border-slate-300 text-slate-500 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-300"
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
              <p className="text-sm text-slate-500">На дату: {format(targetDateForNewLesson, 'dd MMMM yyyy', {locale: uk})}</p>
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
            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white">Створити заняття</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Utility: Persistent State ──────────────────────────────────────────────────
function usePersistentState<T>(key: string, initialValue: T, reviver?: (key: string, value: any) => any) {
  const [state, setState] = useState<T>(() => {
    try {
       const stored = localStorage.getItem(key)
       if (stored) return JSON.parse(stored, reviver)
    } catch(e) {}
    return initialValue
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  return [state, setState] as const
}

const dateReviver = (key: string, value: any) => {
  if (key === 'start_timestamp' || key === 'end_timestamp') return new Date(value)
  return value
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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientPage lessons={lessons} setLessons={setLessons} />} />
        <Route path="/book/:id" element={<BookingPage lessons={lessons} setLessons={setLessons} />} />
        <Route path="/cancel/:id" element={<CancelBookingPage lessons={lessons} setLessons={setLessons} />} />
        
        {/* Admin Section (Protected by mock state wrapper) */}
        <Route path="/admin" element={<AdminLayout isAdminLogged={isAdminLogged} setIsAdminLogged={setIsAdminLogged} />}>
          <Route index element={<AdminHub />} />
          <Route path="schedule" element={<AdminSchedulePage lessons={lessons} setLessons={setLessons} trainers={trainers} classTypes={classTypes} />} />
          <Route path="settings" element={<AdminSettingsPage trainers={trainers} setTrainers={setTrainers} classTypes={classTypes} setClassTypes={setClassTypes} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
