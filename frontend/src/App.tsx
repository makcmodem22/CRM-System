import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, addDays } from 'date-fns'
import {
  Calendar as CalendarIcon, Clock, Users, Shield, User,
  ShieldAlert, CreditCard, ChevronRight, AlertTriangle, X, LogOut, Phone, HelpCircle, CheckCircle2, CopyPlus
} from 'lucide-react'

import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from './components/ui/dialog'
import { Calendar } from './components/ui/calendar'
import { cn } from './lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────
type Role = 'ADMIN' | 'TRAINER' | 'CLIENT'
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
}

// ── Helpers ────────────────────────────────────────────────────────────────
const makeDate = (baseDate: Date, h: number, m: number): Date => {
  const d = new Date(baseDate)
  d.setHours(h, m, 0, 0)
  return d
}

const inputClasses = "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

// ── Main Component ─────────────────────────────────────────────────────────
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [role, setRole] = useState<Role>('CLIENT')

  // User state
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [trainerName, setTrainerName] = useState('Alex Johnson') // Для демо

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

  // Initial Mock Data based on current date
  const [lessons, setLessons] = useState<ActualLesson[]>([
    {
      id: '1',
      class_name: 'Crossfit Basics',
      trainer_name: 'Alex Johnson',
      start_timestamp: makeDate(new Date(), 10, 0),
      end_timestamp: makeDate(new Date(), 11, 0),
      capacity: 10,
      booked_count: 5,
      status: 'SCHEDULED',
      is_booked_by_me: false,
    },
    {
      id: '2',
      class_name: 'Yoga Retreat',
      trainer_name: 'Sarah Smith',
      start_timestamp: makeDate(new Date(), 12, 0),
      end_timestamp: makeDate(new Date(), 13, 30),
      capacity: 15,
      booked_count: 15,
      status: 'SCHEDULED',
      is_booked_by_me: true,
    },
  ])

  // Modals state
  const [bookingLesson, setBookingLesson] = useState<ActualLesson | null>(null)
  const [isProcessingBooking, setIsProcessingBooking] = useState(false)
  const [bookingName, setBookingName] = useState('')
  const [bookingPhone, setBookingPhone] = useState('')

  const [cancelLesson, setCancelLesson] = useState<ActualLesson | null>(null)
  const [isProcessingCancel, setIsProcessingCancel] = useState(false)
  const [cancelBlocked, setCancelBlocked] = useState(false)

  const [adminCancelLesson, setAdminCancelLesson] = useState<ActualLesson | null>(null)
  const [isAdminCancelling, setIsAdminCancelling] = useState(false)

  // New Modals for UI action buttons
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false)
  const [selectedDetailsLesson, setSelectedDetailsLesson] = useState<ActualLesson | null>(null)
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isClientsOpen, setIsClientsOpen] = useState(false)

  // Form states for Add Lesson
  const [newLessonName, setNewLessonName] = useState('Стретчинг')
  const [newLessonTrainer, setNewLessonTrainer] = useState(trainerName)
  const [newLessonTime, setNewLessonTime] = useState('15:00')
  const [newLessonCapacity, setNewLessonCapacity] = useState('10')

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (role === 'ADMIN' && adminPassword !== 'admin123') {
      alert('Невірний пароль адміністратора. (Введіть admin123)')
      return
    }
    if (role === 'CLIENT' && (!clientName || !clientPhone)) {
      alert('Будь ласка, введіть ім\'я та номер телефону.')
      return
    }
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setAdminPassword('')
  }

  const openBookingDialog = (lesson: ActualLesson) => {
    setBookingName(clientName)
    setBookingPhone(clientPhone)
    setBookingLesson(lesson)
  }

  const openCancelDialog = (lesson: ActualLesson) => {
    const hoursLeft =
      (lesson.start_timestamp.getTime() - Date.now()) / (1000 * 60 * 60)
    setCancelBlocked(hoursLeft < 12)
    setCancelLesson(lesson)
  }

  const handleConfirmCancel = async () => {
    if (!cancelLesson || cancelBlocked) return
    setIsProcessingCancel(true)
    await new Promise(r => setTimeout(r, 1200))
    setLessons(prev =>
      prev.map(l =>
        l.id === cancelLesson.id
          ? { ...l, is_booked_by_me: false, booked_count: l.booked_count - 1 }
          : l
      )
    )
    setIsProcessingCancel(false)
    setCancelLesson(null)
  }

  const handleConfirmBooking = async () => {
    if (!bookingLesson) return
    if (!bookingName || !bookingPhone) {
      alert("Будь ласка, заповніть ваші дані")
      return
    }
    setIsProcessingBooking(true)
    await new Promise(r => setTimeout(r, 1500))
    setLessons(prev =>
      prev.map(l =>
        l.id === bookingLesson.id
          ? { ...l, is_booked_by_me: true, booked_count: l.booked_count + 1 }
          : l
      )
    )
    if (role === 'CLIENT') {
      setClientName(bookingName)
      setClientPhone(bookingPhone)
    }
    setIsProcessingBooking(false)
    setBookingLesson(null)
  }

  const handleAdminCancelClass = async () => {
    if (!adminCancelLesson) return
    setIsAdminCancelling(true)
    await new Promise(r => setTimeout(r, 1200))
    setLessons(prev =>
      prev.map(l =>
        l.id === adminCancelLesson.id
          ? { ...l, status: 'CANCELLED' as LessonStatus }
          : l
      ).filter(l => l.status !== 'CANCELLED')
    )
    setIsAdminCancelling(false)
    setAdminCancelLesson(null)
  }

  // Handle Add Lesson Submit
  const handleAddLessonSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate) {
      alert("Виберіть дату в календарі спочатку")
      return
    }
    const [h, m] = newLessonTime.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return

    const newLesson: ActualLesson = {
      id: Math.random().toString(36).substring(7),
      class_name: newLessonName,
      trainer_name: role === 'TRAINER' ? trainerName : newLessonTrainer,
      start_timestamp: makeDate(selectedDate, h, m),
      end_timestamp: makeDate(selectedDate, h + 1, m),
      capacity: parseInt(newLessonCapacity),
      booked_count: 0,
      status: 'SCHEDULED',
      is_booked_by_me: false
    }

    setLessons(prev => [...prev, newLesson].sort((a,b) => a.start_timestamp.getTime() - b.start_timestamp.getTime()))
    setIsAddLessonOpen(false)
  }

  // ── Role colors ───────────────────────────────────────────────────────────
  const roleColors: Record<Role, string> = {
    CLIENT:  'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    TRAINER: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    ADMIN:   'bg-purple-500/10 text-purple-600 border-purple-500/30',
  }

  // Filter lessons for the selected day
  const filteredLessons = lessons.filter(l => {
    if (!selectedDate) return false
    return l.start_timestamp.toDateString() === selectedDate.toDateString()
  })

  // ── Render Login Screen ───────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#f9f9fb] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="shadow-lg border-gray-200">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow">
                <CalendarIcon className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Вхід у CRM</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {(['CLIENT', 'TRAINER', 'ADMIN'] as Role[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        'flex-1 py-2 text-sm font-semibold rounded-md transition-all',
                        role === r ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      {r === 'CLIENT' ? 'Клієнт' : r === 'TRAINER' ? 'Тренер' : 'Адмін'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {role === 'CLIENT' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Ваше ім'я</label>
                        <input
                          type="text"
                          required
                          value={clientName}
                          onChange={e => setClientName(e.target.value)}
                          placeholder="Іван Іванов"
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Номер телефону</label>
                        <input
                          type="tel"
                          required
                          value={clientPhone}
                          onChange={e => setClientPhone(e.target.value)}
                          placeholder="+380 99 000 00 00"
                          className={inputClasses}
                        />
                      </div>
                    </motion.div>
                  )}

                  {role === 'TRAINER' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Оберіть тренера</label>
                        <select 
                          value={trainerName}
                          onChange={e => setTrainerName(e.target.value)}
                          className={inputClasses}
                        >
                          <option>Alex Johnson</option>
                          <option>Sarah Smith</option>
                          <option>Mike Tyson</option>
                        </select>
                      </div>
                    </motion.div>
                  )}

                  {role === 'ADMIN' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Секретний пароль</label>
                        <input
                          type="password"
                          required
                          value={adminPassword}
                          onChange={e => setAdminPassword(e.target.value)}
                          placeholder="Введіть код"
                          className={inputClasses}
                        />
                        <p className="text-xs text-slate-400 mt-1">Використайте admin123 для тесту</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800">
                  Увійти
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ── Render App ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f9f9fb] font-sans text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-gray-200 shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex gap-2.5 items-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow">
              <CalendarIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Titan&nbsp;<span className="text-slate-500 font-medium">Scheduler</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-slate-800">
                {role === 'CLIENT' ? clientName : role === 'TRAINER' ? trainerName : 'Головний Адмін'}
              </span>
              <Badge variant="outline" className={cn('uppercase tracking-widest text-[9px] px-1.5 py-0 shadow-sm border-0 mt-0.5', roleColors[role])}>
                {role}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500 ring-1 ring-slate-200 rounded-full hover:bg-red-50 hover:text-red-600 hover:ring-red-200 transition-all">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="container px-4 sm:px-8 pt-10 pb-24 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="md:col-span-4 lg:col-span-3 space-y-5">
          <Card className="bg-white shadow-sm border border-gray-200 overflow-hidden">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                Оберіть дату
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 px-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="mx-auto"
              />
            </CardContent>
          </Card>

          {role === 'ADMIN' && (
            <Card className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-purple-700">Адміністратор</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" onClick={() => setIsPublishOpen(true)} className="w-full justify-between text-purple-700 border-purple-200 hover:bg-purple-50 text-sm group">
                  Опублікувати тиждень
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>
                <Button variant="outline" onClick={() => setIsClientsOpen(true)} className="w-full justify-between text-purple-700 border-purple-200 hover:bg-purple-50 text-sm group">
                  Управління клієнтами
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>
              </CardContent>
            </Card>
          )}

          {role === 'TRAINER' && (
            <Card className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-blue-700">Панель тренера</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" onClick={() => setIsTemplatesOpen(true)} className="w-full justify-between text-blue-700 border-blue-200 hover:bg-blue-50 text-sm group">
                  Мої шаблони
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column – Schedule */}
        <div className="md:col-span-8 lg:col-span-9 space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Розклад занять</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy') : 'Оберіть дату'}
              </p>
            </div>
            {(role === 'TRAINER' || role === 'ADMIN') && (
              <Button size="sm" onClick={() => setIsAddLessonOpen(true)} className="shadow-sm border-0 bg-slate-900 text-white hover:bg-slate-800">
                + Додати заняття
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            <AnimatePresence>
              {filteredLessons.map((lesson, idx) => {
                const isFull = lesson.booked_count >= lesson.capacity
                const fillPct = Math.min(100, Math.round((lesson.booked_count / lesson.capacity) * 100))

                return (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: idx * 0.07, duration: 0.3 }}
                  >
                    <Card className={cn(
                      "bg-white border shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden",
                      lesson.is_booked_by_me ? "border-emerald-200" : "border-gray-200"
                    )}>
                      <div className={cn(
                        "h-1 w-full",
                        lesson.is_booked_by_me ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-slate-300 to-slate-400"
                      )} />
                      <div className="p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
                        <div className="space-y-2.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 truncate">{lesson.class_name}</h3>
                            {lesson.is_booked_by_me && (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px] px-2 shadow-sm">
                                Ви записані
                              </Badge>
                            )}
                            {isFull && !lesson.is_booked_by_me && (
                              <Badge variant="destructive" className="text-[10px] px-2">Місць немає</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-slate-700">
                                {format(lesson.start_timestamp, 'HH:mm')} – {format(lesson.end_timestamp, 'HH:mm')}
                              </span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {lesson.trainer_name}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {lesson.booked_count} / {lesson.capacity} місць
                            </span>
                          </div>
                          <div className="w-full max-w-xs">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  fillPct >= 100 ? "bg-red-400" : fillPct >= 70 ? "bg-amber-400" : "bg-emerald-400"
                                )}
                                style={{ width: `${fillPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="w-full sm:w-auto shrink-0 flex gap-2">
                          {role === 'CLIENT' && (
                            !lesson.is_booked_by_me ? (
                              <Button
                                size="sm"
                                disabled={isFull}
                                onClick={() => openBookingDialog(lesson)}
                                className="w-full sm:w-28 bg-slate-900 hover:bg-slate-700 text-white shadow-sm"
                              >
                                Записатись
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openCancelDialog(lesson)}
                                className="w-full sm:w-28 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
                              >
                                Скасувати
                              </Button>
                            )
                          )}
                          {(role === 'ADMIN' || role === 'TRAINER') && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => setSelectedDetailsLesson(lesson)} className="flex-1 sm:flex-none sm:w-24">
                                Деталі
                              </Button>
                              {role === 'ADMIN' && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => setAdminCancelLesson(lesson)}
                                  className="flex-1 sm:flex-none border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
                                >
                                  Скасувати
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {filteredLessons.length === 0 && (
              <div className="py-24 flex flex-col items-center text-center text-slate-400 border border-dashed border-gray-200 rounded-xl bg-white/50">
                <CalendarIcon className="w-8 h-8 mb-3 opacity-20" />
                <p>На цей день не знайдено занять.</p>
                {(role === 'ADMIN' || role === 'TRAINER') && (
                  <Button variant="link" onClick={() => setIsAddLessonOpen(true)} className="text-slate-500 mt-2">
                    Створити заняття
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── MODALS (Automated Buttons) ── */}

      {/* Add New Lesson Dialog */}
      <Dialog open={isAddLessonOpen} onOpenChange={setIsAddLessonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Створити нове заняття</DialogTitle>
            <DialogDescription>
              {selectedDate ? `На дату: ${format(selectedDate, 'd MMMM yyyy')}` : 'Оберіть дату'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLessonSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Назва заняття</label>
              <input required value={newLessonName} onChange={e=>setNewLessonName(e.target.value)} className={inputClasses} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Час початку</label>
                <input required type="time" value={newLessonTime} onChange={e=>setNewLessonTime(e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">К-сть місць</label>
                <input required type="number" min="1" value={newLessonCapacity} onChange={e=>setNewLessonCapacity(e.target.value)} className={inputClasses} />
              </div>
            </div>
            {role === 'ADMIN' && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Тренер</label>
                <select required value={newLessonTrainer} onChange={e=>setNewLessonTrainer(e.target.value)} className={inputClasses}>
                  <option>Alex Johnson</option>
                  <option>Sarah Smith</option>
                  <option>Mike Tyson</option>
                </select>
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddLessonOpen(false)}>Скасувати</Button>
              <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">Додати до розкладу</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Publish Week Dialog */}
      <Dialog open={isPublishOpen} onOpenChange={setIsPublishOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4 mt-2">
            <CheckCircle2 className="w-6 h-6 text-purple-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">Розклад опубліковано</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Шаблони на наступний тиждень успішно згенеровані. Тепер клієнти можуть записуватись.
            </DialogDescription>
          </DialogHeader>
          <Button className="w-full mt-4" onClick={() => setIsPublishOpen(false)}>Зрозуміло</Button>
        </DialogContent>
      </Dialog>

      {/* Client List Stub Dialog */}
      <Dialog open={isClientsOpen} onOpenChange={setIsClientsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Управління клієнтами</DialogTitle>
            <DialogDescription>База клієнтів завантажена. Пошук тимчасово вимкнено.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {['Іван Іванов - +380990000000', 'Олена Петренко - +380671112233', 'Максим Коваль - +380630005544'].map((c, i) => (
              <div key={i} className="text-sm p-3 border rounded-lg bg-slate-50 flex items-center justify-between">
                <span>{c}</span>
                <Button size="sm" variant="ghost">Профіль</Button>
              </div>
            ))}
          </div>
          <Button className="w-full mt-2" onClick={() => setIsClientsOpen(false)}>Закрити</Button>
        </DialogContent>
      </Dialog>

      {/* Trainer Templates Stub */}
      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Мої шаблони ({trainerName})</DialogTitle>
            <DialogDescription>Тут ви можете налаштувати постійні заняття на тиждень.</DialogDescription>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-slate-400 gap-2">
            <CopyPlus className="w-8 h-8 opacity-50" />
            <p>У вас ще немає шаблонів</p>
          </div>
          <Button variant="outline" className="w-full border-dashed border-2">
            + Створити шаблон
          </Button>
        </DialogContent>
      </Dialog>

      {/* Lesson Details Dialog */}
      <Dialog open={!!selectedDetailsLesson} onOpenChange={open => !open && setSelectedDetailsLesson(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Деталі заняття</DialogTitle>
          </DialogHeader>
          {selectedDetailsLesson && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg border">
                <p className="font-bold">{selectedDetailsLesson.class_name}</p>
                <div className="text-sm text-slate-500 mt-2 grid grid-cols-2 gap-2">
                  <span>Тренер: {selectedDetailsLesson.trainer_name}</span>
                  <span>Зайнято: {selectedDetailsLesson.booked_count} з {selectedDetailsLesson.capacity}</span>
                </div>
              </div>
              <div>
                <p className="font-bold text-sm mb-2">Список присутніх (Демо):</p>
                {selectedDetailsLesson.booked_count > 0 ? (
                  <ul className="text-sm space-y-1 pl-4 list-disc text-slate-600">
                    <li>Іван Іванов (Сплачено)</li>
                    <li>Олена Петренко (Сплачено)</li>
                    {selectedDetailsLesson.booked_count > 2 && <li>... та інші</li>}
                  </ul>
                ) : (
                   <p className="text-sm text-slate-400 italic">Поки немає жодних записів на це заняття.</p>
                )}
              </div>
            </div>
          )}
          <Button className="w-full mt-2" onClick={() => setSelectedDetailsLesson(null)}>Закрити</Button>
        </DialogContent>
      </Dialog>

      {/* ── Booking Dialog ── */}
      <Dialog open={!!bookingLesson} onOpenChange={open => !open && setBookingLesson(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Бронювання заняття</DialogTitle>
            <DialogDescription className="text-slate-500 mt-1">Оновіть свої дані для запису</DialogDescription>
          </DialogHeader>
          {bookingLesson && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <p className="font-semibold text-slate-900 text-base">{bookingLesson.class_name}</p>
              </div>
              <div className="space-y-3 px-1 pt-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Ваше ім'я
                  </label>
                  <input type="text" value={bookingName} onChange={e => setBookingName(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Номер телефону
                  </label>
                  <input type="tel" value={bookingPhone} onChange={e => setBookingPhone(e.target.value)} className={inputClasses} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingLesson(null)}>Скасувати</Button>
            <Button onClick={handleConfirmBooking} disabled={isProcessingBooking} className="bg-slate-900 text-white min-w-[120px]">
              {isProcessingBooking ? 'Обробка…' : 'До оплати →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirmation Dialog ── */}
      <Dialog open={!!cancelLesson} onOpenChange={open => !open && setCancelLesson(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">Скасування бронювання</DialogTitle>
          </DialogHeader>
          {cancelLesson && (
            <div className="py-2">
              <p className="text-sm text-amber-800 p-4 rounded-xl bg-amber-50">Бронювання буде скасовано. Буде ініційовано Refund.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelLesson(null)}>Закрити</Button>
            <Button variant="destructive" onClick={handleConfirmCancel} disabled={isProcessingCancel}>Скасувати</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Admin Cancel Class Dialog ── */}
      <Dialog open={!!adminCancelLesson} onOpenChange={open => !open && setAdminCancelLesson(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-red-600">
              <AlertTriangle className="w-5 h-5" /> Скасування всього заняття
            </DialogTitle>
          </DialogHeader>
          {adminCancelLesson && (
            <div className="py-2">
              <p className="text-sm text-red-800 p-4 bg-red-50 rounded-xl">Ви збираєтесь видалити це заняття для всіх клієнтів.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminCancelLesson(null)}>Закрити</Button>
            <Button variant="destructive" onClick={handleAdminCancelClass} disabled={isAdminCancelling}>Так, видалити</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
