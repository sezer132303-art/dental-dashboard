'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Clock, User } from 'lucide-react'
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

export default function CalendarPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
    return new Date(now.setDate(diff))
  })

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

  // Fetch appointments for the week
  useEffect(() => {
    const fetchAppointments = async () => {
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

        const response = await fetch(`/api/appointments?${params.toString()}`)
        const data = await response.json()

        if (data.appointments) {
          setAppointments(data.appointments)
        }
      } catch (err) {
        console.error('Error fetching appointments:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()
  }, [currentWeekStart, selectedDoctor])

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const addDays = (date: Date, days: number) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
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

        <h2 className="text-lg font-semibold text-gray-900">
          {currentWeekStart.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}
        </h2>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Тази седмица: <strong className="text-gray-900">{weekAppointments}</strong> часа</span>
          <span>Днес: <strong className="text-gray-900">{todayAppointments}</strong> часа</span>
        </div>
      </div>

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
