'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Clock, User, CalendarDays, X, Phone, Stethoscope, Check, XCircle, Edit3, Save, MessageSquare, RefreshCw, List, Grid3X3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabase } from '@/lib/supabase'

interface Doctor {
  id: string
  name: string
  specialty: string | null
  color: string
}

interface Appointment {
  id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: string
  type: string | null
  notes: string | null
  doctor: {
    id: string
    name: string
    color: string
  } | null
  patient: {
    id: string
    name: string
    phone: string
  } | null
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500',
  confirmed: 'bg-indigo-500',
  completed: 'bg-green-500',
  no_show: 'bg-red-500',
  cancelled: 'bg-gray-400'
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8) // 8:00 - 18:00

export default function CalendarPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerMonth, setPickerMonth] = useState<Date | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ status: '', type: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week')
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([])
  const [loadingAll, setLoadingAll] = useState(false)

  // Calculate Monday of the current week - only on client side
  const getMonday = (date: Date): Date => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayOfWeek = d.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    d.setDate(d.getDate() - daysFromMonday)
    return d
  }

  // Initialize on client side only to avoid SSR timezone issues
  useEffect(() => {
    const now = new Date()
    setIsClient(true)
    setCurrentWeekStart(getMonday(now))
    setPickerMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }, [])

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await fetch('/api/doctors')
        const data = await response.json()
        if (data.doctors) {
          setDoctors(data.doctors)
          if (data.doctors.length > 0 && !selectedDoctor) {
            setSelectedDoctor(data.doctors[0])
          }
        }
      } catch (err) {
        console.error('Error fetching doctors:', err)
      }
    }
    fetchDoctors()
  }, [])

  // Helper function to format date (needed before useCallback)
  const formatDateHelper = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const addDaysHelper = (date: Date, days: number) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  // Fetch appointments function
  const fetchAppointments = useCallback(async (weekStart: Date, doctor: Doctor | null, showLoadingState = true) => {
    try {
      if (showLoadingState) setLoading(true)
      const startDate = formatDateHelper(weekStart)
      const endDate = formatDateHelper(addDaysHelper(weekStart, 6))

      const params = new URLSearchParams({
        startDate,
        endDate
      })

      if (doctor) {
        params.append('doctorId', doctor.id)
      }

      const response = await fetch(`/api/appointments?${params.toString()}`)
      const data = await response.json()

      if (data.appointments) {
        setAppointments(data.appointments)
        setLastSync(new Date())
      }
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      if (showLoadingState) setLoading(false)
    }
  }, [])

  // Fetch appointments for the week
  useEffect(() => {
    if (!currentWeekStart) return
    fetchAppointments(currentWeekStart, selectedDoctor)
  }, [currentWeekStart, selectedDoctor, fetchAppointments])

  // Real-time subscription for appointments
  useEffect(() => {
    if (!currentWeekStart) return

    const supabase = getSupabase()

    // Subscribe to appointment changes
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Appointment change detected:', payload)
          // Refetch appointments when any change occurs
          fetchAppointments(currentWeekStart, selectedDoctor, false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentWeekStart, selectedDoctor, fetchAppointments])

  // Manual refresh function - triggers Google Calendar sync
  const handleManualRefresh = async () => {
    if (!currentWeekStart || syncing) return
    setSyncing(true)

    try {
      // Trigger Google Calendar sync via n8n
      const syncResponse = await fetch('/api/calendar/sync', { method: 'POST' })

      if (!syncResponse.ok) {
        console.error('Calendar sync failed')
      }

      // Wait a moment for sync to complete, then fetch updated appointments
      await new Promise(resolve => setTimeout(resolve, 2000))
      await fetchAppointments(currentWeekStart, selectedDoctor, false)
    } catch (error) {
      console.error('Sync error:', error)
      // Still try to fetch appointments even if sync fails
      await fetchAppointments(currentWeekStart, selectedDoctor, false)
    }

    setSyncing(false)
  }

  // Fetch all upcoming appointments for list view
  const fetchAllAppointments = useCallback(async () => {
    try {
      setLoadingAll(true)
      const today = new Date()
      const startDate = formatDateHelper(today)
      // Get appointments for next 60 days
      const endDate = formatDateHelper(addDaysHelper(today, 60))

      const params = new URLSearchParams({ startDate, endDate })
      if (selectedDoctor) {
        params.append('doctorId', selectedDoctor.id)
      }

      const response = await fetch(`/api/appointments?${params.toString()}`)
      const data = await response.json()

      if (data.appointments) {
        // Sort by date and time
        const sorted = data.appointments.sort((a: Appointment, b: Appointment) => {
          const dateCompare = a.appointment_date.localeCompare(b.appointment_date)
          if (dateCompare !== 0) return dateCompare
          return a.start_time.localeCompare(b.start_time)
        })
        setAllAppointments(sorted)
      }
    } catch (err) {
      console.error('Error fetching all appointments:', err)
    } finally {
      setLoadingAll(false)
    }
  }, [selectedDoctor])

  // Fetch all appointments when switching to list view
  useEffect(() => {
    if (viewMode === 'list') {
      fetchAllAppointments()
    }
  }, [viewMode, selectedDoctor, fetchAllAppointments])

  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const addDays = (date: Date, days: number) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  const getWeekDays = () => {
    if (!currentWeekStart) return []
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
  }

  const formatDayHeader = (date: Date) => {
    const days = ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб']
    return `${days[date.getDay()]} ${date.getDate()}`
  }

  const getAppointmentsForDay = (date: Date) => {
    const dateStr = formatDate(date)
    return appointments.filter(apt => apt.appointment_date === dateStr)
  }

  const getAppointmentPosition = (apt: Appointment) => {
    const startParts = apt.start_time.split(':')
    const endParts = apt.end_time.split(':')
    const startHour = parseInt(startParts[0]) + parseInt(startParts[1]) / 60
    const endHour = parseInt(endParts[0]) + parseInt(endParts[1]) / 60

    // Clamp to visible hours (8:00 - 18:00)
    const clampedStart = Math.max(startHour, 8)
    const clampedEnd = Math.min(endHour, 19) // 18:00 + 1 hour buffer

    const top = Math.max(0, (clampedStart - 8) * 60) // 60px per hour, starting from 8:00
    const height = Math.max(45, (clampedEnd - clampedStart) * 60) // Minimum 45px for visible content

    // Max height is the grid height (11 hours * 60px = 660px)
    const maxTop = 11 * 60
    const clampedTop = Math.min(top, maxTop - 45)
    const clampedHeight = Math.min(height, maxTop - clampedTop)

    return { top: clampedTop, height: clampedHeight }
  }

  const prevWeek = () => {
    if (currentWeekStart) {
      setCurrentWeekStart(addDays(currentWeekStart, -7))
    }
  }

  const nextWeek = () => {
    if (currentWeekStart) {
      setCurrentWeekStart(addDays(currentWeekStart, 7))
    }
  }

  const goToToday = () => {
    setCurrentWeekStart(getMonday(new Date()))
  }

  const goToDate = (date: Date) => {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const monday = getMonday(targetDate)
    setSelectedDate(targetDate) // Track the selected date
    setCurrentWeekStart(new Date(monday.getTime()))
    setShowDatePicker(false)
  }

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []

    // Add empty days for alignment (week starts on Monday)
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const prevPickerMonth = () => {
    if (pickerMonth) {
      setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))
    }
  }

  const nextPickerMonth = () => {
    if (pickerMonth) {
      setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))
    }
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return formatDate(date) === formatDate(today)
  }

  const isSelectedDay = (date: Date) => {
    return selectedDate && formatDate(date) === formatDate(selectedDate)
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith('359')) {
      return `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`
    }
    return phone
  }

  const formatDisplayDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('bg-BG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const statusLabels: Record<string, string> = {
    scheduled: 'Насрочен',
    confirmed: 'Потвърден',
    completed: 'Завършен',
    no_show: 'Неявил се',
    cancelled: 'Отменен'
  }

  const openAppointmentModal = (apt: Appointment) => {
    setSelectedAppointment(apt)
    setEditForm({
      status: apt.status,
      type: apt.type || '',
      notes: apt.notes || ''
    })
    setIsEditing(false)
  }

  const updateAppointment = async (updates: Partial<{ status: string; type: string; notes: string }>) => {
    if (!selectedAppointment) return

    setSaving(true)
    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        // Update local state
        setAppointments(prev =>
          prev.map(apt =>
            apt.id === selectedAppointment.id
              ? { ...apt, ...updates }
              : apt
          )
        )
        setSelectedAppointment(prev => prev ? { ...prev, ...updates } : null)
        setIsEditing(false)
      }
    } catch (err) {
      console.error('Error updating appointment:', err)
    } finally {
      setSaving(false)
    }
  }

  const quickStatusChange = async (newStatus: string) => {
    await updateAppointment({ status: newStatus })
  }

  const saveEdits = async () => {
    await updateAppointment({
      status: editForm.status,
      type: editForm.type || null,
      notes: editForm.notes || null
    } as any)
  }

  const weekDays = getWeekDays()

  // Calculate stats
  const weekAppointments = appointments.length
  const todayAppointments = appointments.filter(
    apt => apt.appointment_date === formatDate(new Date())
  ).length

  // Show loading while initializing client-side date
  if (!currentWeekStart) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sync Status Bar */}
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Автоматична синхронизация с Google Calendar</span>
          {lastSync && (
            <span className="text-green-600">
              (последно: {lastSync.toLocaleTimeString('bg-BG')})
            </span>
          )}
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={syncing}
          className="flex items-center gap-1 px-3 py-1 text-sm text-green-700 hover:bg-green-100 rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
          {syncing ? 'Синхронизиране...' : 'Обнови'}
        </button>
      </div>

      {/* Doctor Selection */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedDoctor(null)}
          className={cn(
            'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
            !selectedDoctor
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          )}
        >
          Всички лекари
        </button>
        {doctors.map((doctor) => (
          <button
            key={doctor.id}
            onClick={() => setSelectedDoctor(doctor)}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              selectedDoctor?.id === doctor.id
                ? `${doctor.color || 'bg-blue-600'} text-white`
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            )}
          >
            {doctor.name}
          </button>
        ))}

        {/* View Mode Toggle */}
        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'week'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Grid3X3 className="w-4 h-4" />
            Седмица
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'list'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <List className="w-4 h-4" />
            Всички
          </button>
        </div>
      </div>

      {/* Week Navigation - only show in week view */}
      {viewMode === 'week' && (
      <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            Днес
          </button>
        </div>

        {/* Clickable Date Header with Date Picker */}
        <div className="relative" ref={datePickerRef}>
          <button
            onClick={() => {
              setPickerMonth(currentWeekStart)
              setShowDatePicker(!showDatePicker)
            }}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition"
          >
            <CalendarDays className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {currentWeekStart.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}
            </h2>
          </button>

          {/* Date Picker Dropdown */}
          {showDatePicker && pickerMonth && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 w-72">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={prevPickerMonth}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold text-gray-900">
                  {pickerMonth.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={nextPickerMonth}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {getMonthDays(pickerMonth).map((day, index) => (
                  <button
                    key={index}
                    onClick={() => day && goToDate(day)}
                    disabled={!day}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm transition',
                      !day && 'invisible',
                      day && isToday(day) && 'bg-blue-600 text-white font-bold',
                      day && !isToday(day) && 'hover:bg-gray-100 text-gray-900',
                      day && formatDate(day) >= formatDate(currentWeekStart) &&
                        formatDate(day) <= formatDate(addDays(currentWeekStart, 6)) &&
                        !isToday(day) && 'bg-blue-100 text-blue-700'
                    )}
                  >
                    {day?.getDate()}
                  </button>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    goToDate(new Date())
                    setShowDatePicker(false)
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  Днес
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Затвори
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Тази седмица: <strong className="text-gray-900">{weekAppointments}</strong> часа</span>
          <span>Днес: <strong className="text-gray-900">{todayAppointments}</strong> часа</span>
        </div>
      </div>
      )}

      {/* List View - All Appointments */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Всички предстоящи часове</h2>
            <p className="text-sm text-gray-500">Следващите 60 дни</p>
          </div>
          {loadingAll ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : allAppointments.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-gray-500">
              Няма предстоящи часове
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {allAppointments.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => openAppointmentModal(apt)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <div className="text-lg font-bold text-gray-900">
                          {new Date(apt.appointment_date).getDate()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(apt.appointment_date).toLocaleDateString('bg-BG', { month: 'short' })}
                        </div>
                      </div>
                      <div className="h-12 w-px bg-gray-200" />
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}
                          </span>
                          <span className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full text-white',
                            statusColors[apt.status] || 'bg-blue-500'
                          )}>
                            {statusLabels[apt.status] || apt.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{apt.patient?.name || 'Неизвестен пациент'}</span>
                          {apt.type && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-gray-500">{apt.type}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {apt.doctor && (
                        <div className="flex items-center gap-2">
                          <div className={cn('w-3 h-3 rounded-full', apt.doctor.color || 'bg-blue-500')} />
                          <span className="text-sm text-gray-600">{apt.doctor.name}</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(apt.appointment_date).toLocaleDateString('bg-BG', { weekday: 'long' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar Grid - Week View */}
      {viewMode === 'week' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-[600px]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="grid grid-cols-8 border-b border-gray-100">
                <div className="p-3 text-sm font-medium text-gray-500 border-r border-gray-100">
                  Час
                </div>
                {weekDays.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      'p-3 text-center text-sm font-medium border-r border-gray-100 last:border-r-0 transition-colors',
                      isToday(day) && 'bg-blue-50 text-blue-600',
                      isSelectedDay(day) && !isToday(day) && 'bg-purple-50 text-purple-600 ring-2 ring-purple-400 ring-inset',
                      isSelectedDay(day) && isToday(day) && 'ring-2 ring-blue-400 ring-inset',
                      !isToday(day) && !isSelectedDay(day) && 'text-gray-700'
                    )}
                  >
                    {formatDayHeader(day)}
                    {isSelectedDay(day) && (
                      <div className="text-xs mt-0.5 opacity-75">избран</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Time Grid */}
              <div className="relative overflow-hidden">
                {/* Hour Lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="grid grid-cols-8 border-b border-gray-50"
                    style={{ height: '60px' }}
                  >
                    <div className="p-2 text-xs text-gray-400 border-r border-gray-100 flex items-start">
                      {hour}:00
                    </div>
                    {weekDays.map((day, i) => (
                      <div
                        key={i}
                        className={cn(
                          'border-r border-gray-50 last:border-r-0',
                          isSelectedDay(day) && !isToday(day) && 'bg-purple-50/30',
                          isSelectedDay(day) && isToday(day) && 'bg-blue-50/50'
                        )}
                      />
                    ))}
                  </div>
                ))}

                {/* Appointments Overlay */}
                <div className="absolute inset-0 grid grid-cols-8 pointer-events-none overflow-hidden">
                  <div /> {/* Time column spacer */}
                  {weekDays.map((day, dayIndex) => (
                    <div key={dayIndex} className="relative overflow-hidden">
                      {getAppointmentsForDay(day).map((apt) => {
                        const { top, height } = getAppointmentPosition(apt)
                        const doctorColor = apt.doctor?.color || 'bg-blue-500'

                        return (
                          <div
                            key={apt.id}
                            className={cn(
                              'absolute left-1 right-1 rounded-md px-2 py-1 text-white text-xs overflow-hidden pointer-events-auto cursor-pointer hover:opacity-90 hover:shadow-lg transition',
                              statusColors[apt.status] || doctorColor
                            )}
                            style={{ top: `${top}px`, height: `${Math.max(height, 45)}px` }}
                            title={`${apt.patient?.name || 'Пациент'} - ${apt.type || 'Преглед'} - ${apt.start_time.slice(0, 5)} - ${apt.end_time.slice(0, 5)}`}
                            onClick={() => openAppointmentModal(apt)}
                          >
                            {/* Always show time range */}
                            <div className="font-semibold text-[11px] leading-tight">
                              {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}
                            </div>
                            {/* Always show patient name */}
                            <div className="font-medium truncate text-[11px] leading-tight">
                              {apt.patient?.name || 'Пациент'}
                            </div>
                            {/* Always show service type */}
                            <div className="text-white/90 truncate text-[10px] leading-tight">
                              {apt.type || 'Преглед'}
                            </div>
                            {/* Show doctor if more space and viewing all doctors */}
                            {height > 55 && apt.doctor && !selectedDoctor && (
                              <div className="text-white/80 truncate text-[9px] leading-tight">
                                {apt.doctor.name}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Quick Stats per Doctor */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {doctors.map((doctor) => {
          const doctorAppointments = appointments.filter(
            apt => apt.doctor?.id === doctor.id
          )
          const todayCount = doctorAppointments.filter(
            apt => apt.appointment_date === formatDate(new Date())
          ).length

          return (
            <div
              key={doctor.id}
              className={cn(
                'bg-white rounded-xl p-4 shadow-sm border-2 transition cursor-pointer hover:shadow-md',
                selectedDoctor?.id === doctor.id ? 'border-blue-500' : 'border-gray-100'
              )}
              onClick={() => setSelectedDoctor(doctor)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold',
                    doctor.color || 'bg-blue-500'
                  )}
                >
                  {doctor.name.split(' ')[1]?.charAt(0) || doctor.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{doctor.name}</h4>
                  <p className="text-xs text-gray-500">{doctor.specialty || 'Общ стоматолог'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-gray-900">{todayCount}</p>
                  <p className="text-xs text-gray-500">днес</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-gray-900">{doctorAppointments.length}</p>
                  <p className="text-xs text-gray-500">седмица</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedAppointment(null)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Редактирай час' : 'Детайли за часа'}
              </h2>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-blue-50 rounded-lg transition text-blue-600"
                    title="Редактирай"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedAppointment(null)
                    setIsEditing(false)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Quick Actions - Always visible */}
            {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Бързи действия:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => quickStatusChange('confirmed')}
                    disabled={saving || selectedAppointment.status === 'confirmed'}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition',
                      selectedAppointment.status === 'confirmed'
                        ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    )}
                  >
                    <Check className="w-4 h-4" />
                    Потвърди
                  </button>
                  <button
                    onClick={() => quickStatusChange('completed')}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                  >
                    <Check className="w-4 h-4" />
                    Завърши
                  </button>
                  <button
                    onClick={() => quickStatusChange('no_show')}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                  >
                    <XCircle className="w-4 h-4" />
                    Неявил се
                  </button>
                  <button
                    onClick={() => quickStatusChange('cancelled')}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    <X className="w-4 h-4" />
                    Отмени
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Patient Name */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <User className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">Пациент</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedAppointment.patient?.name || 'Неизвестен'}
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <Phone className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm text-green-600 font-medium">Телефон</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedAppointment.patient?.phone
                      ? formatPhone(selectedAppointment.patient.phone)
                      : 'Не е посочен'}
                  </p>
                  {selectedAppointment.patient?.phone && (
                    <a
                      href={`tel:+${selectedAppointment.patient.phone}`}
                      className="text-sm text-green-600 hover:underline"
                    >
                      Обади се
                    </a>
                  )}
                </div>
              </div>

              {/* Service/Type - Editable */}
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                <Stethoscope className="w-5 h-5 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-purple-600 font-medium">Услуга</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      placeholder="Преглед, Почистване, Пломба..."
                      className="w-full mt-1 px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                    />
                  ) : (
                    <p className="text-lg font-bold text-gray-900">
                      {selectedAppointment.type || 'Преглед'}
                    </p>
                  )}
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="text-sm text-orange-600 font-medium">Дата и час</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedAppointment.start_time.slice(0, 5)} - {selectedAppointment.end_time.slice(0, 5)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatDisplayDate(selectedAppointment.appointment_date)}
                  </p>
                </div>
              </div>

              {/* Doctor */}
              {selectedAppointment.doctor && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full mt-0.5',
                      selectedAppointment.doctor.color || 'bg-blue-500'
                    )}
                  />
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Лекар</p>
                    <p className="text-lg font-bold text-gray-900">
                      {selectedAppointment.doctor.name}
                    </p>
                  </div>
                </div>
              )}

              {/* Status - Editable */}
              <div className="p-3 bg-gray-100 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Статус:</span>
                  {isEditing ? (
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    >
                      <option value="scheduled">Насрочен</option>
                      <option value="confirmed">Потвърден</option>
                      <option value="completed">Завършен</option>
                      <option value="no_show">Неявил се</option>
                      <option value="cancelled">Отменен</option>
                    </select>
                  ) : (
                    <span className={cn(
                      'px-3 py-1 text-sm font-medium rounded-full text-white',
                      statusColors[selectedAppointment.status] || 'bg-blue-500'
                    )}>
                      {statusLabels[selectedAppointment.status] || selectedAppointment.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Notes - Editable */}
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-yellow-700" />
                  <p className="text-sm text-yellow-700 font-medium">Бележки:</p>
                </div>
                {isEditing ? (
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Добави бележки..."
                    className="w-full px-3 py-2 border border-yellow-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-900"
                  />
                ) : (
                  <p className="text-gray-900">
                    {selectedAppointment.notes || <span className="text-gray-400 italic">Няма бележки</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditForm({
                        status: selectedAppointment.status,
                        type: selectedAppointment.type || '',
                        notes: selectedAppointment.notes || ''
                      })
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                  >
                    Отказ
                  </button>
                  <button
                    onClick={saveEdits}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {saving ? 'Запазване...' : 'Запази'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                >
                  Затвори
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
