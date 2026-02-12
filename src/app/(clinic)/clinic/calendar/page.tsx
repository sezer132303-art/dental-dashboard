'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, CalendarDays, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

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

export default function ClinicCalendarPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(new Date())
  const datePickerRef = useRef<HTMLDivElement>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
    return new Date(now.setDate(diff))
  })

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
        const response = await fetch('/api/clinic/doctors')
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

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const addDays = (date: Date, days: number) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  // Fetch appointments for the week
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true)
      const startDate = formatDate(currentWeekStart)
      const endDate = formatDate(addDays(currentWeekStart, 6))

      const params = new URLSearchParams({
        startDate,
        endDate
      })

      if (selectedDoctor) {
        params.append('doctorId', selectedDoctor.id)
      }

      const response = await fetch(`/api/clinic/appointments?${params.toString()}`)
      const data = await response.json()

      if (data.appointments) {
        setAppointments(data.appointments)
      }
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [currentWeekStart, selectedDoctor])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Sync with Google Calendar
  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const response = await fetch('/api/calendar/sync', { method: 'POST' })
      if (response.ok) {
        setSyncMessage({ type: 'success', text: 'Синхронизацията стартира' })
        // Wait a bit and refresh appointments
        setTimeout(() => {
          fetchAppointments()
          setSyncMessage(null)
        }, 3000)
      } else {
        setSyncMessage({ type: 'error', text: 'Грешка при синхронизация' })
      }
    } catch (err) {
      console.error('Sync error:', err)
      setSyncMessage({ type: 'error', text: 'Грешка при синхронизация' })
    } finally {
      setSyncing(false)
    }
  }

  // Manual refresh
  const handleRefresh = () => {
    fetchAppointments()
  }

  const getWeekDays = () => {
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

    const top = (startHour - 8) * 60 // 60px per hour, starting from 8:00
    const height = (endHour - startHour) * 60

    return { top, height }
  }

  const prevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7))
  }

  const nextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7))
  }

  const goToToday = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    setCurrentWeekStart(new Date(now.setDate(diff)))
  }

  const goToDate = (date: Date) => {
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(date)
    weekStart.setDate(diff)
    setCurrentWeekStart(weekStart)
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
    setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))
  }

  const nextPickerMonth = () => {
    setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return formatDate(date) === formatDate(today)
  }

  const weekDays = getWeekDays()

  // Calculate stats
  const weekAppointments = appointments.length
  const todayAppointments = appointments.filter(
    apt => apt.appointment_date === formatDate(new Date())
  ).length

  return (
    <div className="space-y-6">
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
      </div>

      {/* Week Navigation */}
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
          {showDatePicker && (
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

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Тази седмица: <strong className="text-gray-900">{weekAppointments}</strong> часа</span>
            <span>Днес: <strong className="text-gray-900">{todayAppointments}</strong> часа</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              title="Обнови данните"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              Обнови
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              title="Синхронизирай с Google Calendar"
            >
              <CalendarDays className={cn('w-4 h-4', syncing && 'animate-pulse')} />
              {syncing ? 'Синхронизиране...' : 'Синхронизирай'}
            </button>
          </div>
        </div>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <div className={cn(
          'p-3 rounded-lg text-sm font-medium',
          syncMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        )}>
          {syncMessage.text}
        </div>
      )}

      {/* Calendar Grid */}
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
                      'p-3 text-center text-sm font-medium border-r border-gray-100 last:border-r-0',
                      isToday(day) ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    )}
                  >
                    {formatDayHeader(day)}
                  </div>
                ))}
              </div>

              {/* Time Grid */}
              <div className="relative">
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
                    {weekDays.map((_, i) => (
                      <div
                        key={i}
                        className="border-r border-gray-50 last:border-r-0"
                      />
                    ))}
                  </div>
                ))}

                {/* Appointments Overlay */}
                <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                  <div /> {/* Time column spacer */}
                  {weekDays.map((day, dayIndex) => (
                    <div key={dayIndex} className="relative">
                      {getAppointmentsForDay(day).map((apt) => {
                        const { top, height } = getAppointmentPosition(apt)
                        const doctorColor = apt.doctor?.color || 'bg-blue-500'

                        return (
                          <div
                            key={apt.id}
                            className={cn(
                              'absolute left-1 right-1 rounded-md px-2 py-1 text-white text-xs overflow-hidden pointer-events-auto cursor-pointer hover:opacity-90 transition',
                              statusColors[apt.status] || doctorColor
                            )}
                            style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                            title={`${apt.patient?.name || 'Пациент'} - ${apt.type || 'Час'}`}
                          >
                            <div className="font-medium truncate">
                              {apt.patient?.name || 'Пациент'}
                            </div>
                            {height > 30 && (
                              <div className="text-white/80 truncate">
                                {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}
                              </div>
                            )}
                            {height > 50 && apt.doctor && !selectedDoctor && (
                              <div className="text-white/80 truncate">
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
    </div>
  )
}
