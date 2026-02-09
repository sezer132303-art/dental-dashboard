'use client'

import { useEffect, useState } from 'react'
import { Calendar, Search, Filter, ChevronDown, Loader2, Plus, Clock, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: string
  type: string | null
  notes: string | null
  price: number | null
  doctor_id: string | null
  patient_id: string | null
  doctor: {
    id: string
    name: string
    specialty: string | null
    color: string
  } | null
  patient: {
    id: string
    name: string
    phone: string
  } | null
}

interface Doctor {
  id: string
  name: string
  specialty: string | null
  color: string
}

interface Patient {
  id: string
  name: string
  phone: string
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
}

const statusLabels: Record<string, string> = {
  scheduled: 'Насрочен',
  confirmed: 'Потвърден',
  completed: 'Завършен',
  no_show: 'Неявил се',
  cancelled: 'Отменен'
}

const initialFormData = {
  appointment_date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
  end_time: '09:30',
  doctor_id: '',
  patient_id: '',
  type: '',
  notes: '',
  price: '',
  status: 'scheduled'
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<string>('')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAppointments()
    fetchDoctors()
    fetchPatients()
  }, [statusFilter, dateFilter])

  async function fetchAppointments() {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (statusFilter) {
        params.append('status', statusFilter)
      }

      if (dateFilter) {
        params.append('date', dateFilter)
      }

      const url = `/api/appointments${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.appointments) {
        setAppointments(data.appointments)
      }
    } catch (err) {
      console.error('Error fetching appointments:', err)
      setError('Грешка при зареждане на часове')
    } finally {
      setLoading(false)
    }
  }

  async function fetchDoctors() {
    try {
      const response = await fetch('/api/doctors')
      const data = await response.json()
      if (data.doctors) {
        setDoctors(data.doctors)
      }
    } catch (err) {
      console.error('Error fetching doctors:', err)
    }
  }

  async function fetchPatients() {
    try {
      const response = await fetch('/api/patients')
      const data = await response.json()
      if (data.patients) {
        setPatients(data.patients)
      }
    } catch (err) {
      console.error('Error fetching patients:', err)
    }
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith('359')) {
      return `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`
    }
    return phone
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('bg-BG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    })
  }

  const formatTime = (time: string) => {
    return time.slice(0, 5) // "09:00:00" -> "09:00"
  }

  // Filter appointments by search query (client-side)
  const filteredAppointments = appointments.filter(apt => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      apt.patient?.name.toLowerCase().includes(query) ||
      apt.patient?.phone.includes(query) ||
      apt.doctor?.name.toLowerCase().includes(query)
    )
  })

  // Group appointments by date
  const groupedAppointments = filteredAppointments.reduce((groups, apt) => {
    const date = apt.appointment_date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(apt)
    return groups
  }, {} as Record<string, Appointment[]>)

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        setAppointments(prev =>
          prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt)
        )
      }
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  function openAddModal() {
    setEditingAppointment(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  function openEditModal(appointment: Appointment) {
    setEditingAppointment(appointment)
    setFormData({
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time.slice(0, 5),
      end_time: appointment.end_time.slice(0, 5),
      doctor_id: appointment.doctor_id || '',
      patient_id: appointment.patient_id || '',
      type: appointment.type || '',
      notes: appointment.notes || '',
      price: appointment.price?.toString() || '',
      status: appointment.status
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingAppointment
        ? `/api/appointments/${editingAppointment.id}`
        : '/api/appointments'
      const method = editingAppointment ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: formData.price ? parseFloat(formData.price) : null
        })
      })

      if (response.ok) {
        setShowModal(false)
        setFormData(initialFormData)
        setEditingAppointment(null)
        fetchAppointments()
      } else {
        const data = await response.json()
        alert(data.error || 'Грешка при запазване')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Грешка при запазване')
    } finally {
      setSaving(false)
    }
  }

  if (loading && appointments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Търси по име или телефон..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          />
        </div>

        <div className="flex gap-2">
          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              <Filter className="w-5 h-5" />
              {statusFilter ? statusLabels[statusFilter] : 'Статус'}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showStatusDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-10">
                <button
                  onClick={() => { setStatusFilter(''); setShowStatusDropdown(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
                >
                  Всички
                </button>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setStatusFilter(key); setShowStatusDropdown(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            />
          </div>

          {/* Add Button */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Нов час</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Общо часове</p>
          <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Насрочени</p>
          <p className="text-2xl font-bold text-blue-600">
            {appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Завършени</p>
          <p className="text-2xl font-bold text-green-600">
            {appointments.filter(a => a.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Неявявания</p>
          <p className="text-2xl font-bold text-red-600">
            {appointments.filter(a => a.status === 'no_show').length}
          </p>
        </div>
      </div>

      {/* Appointments List */}
      {Object.keys(groupedAppointments).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedAppointments).map(([date, dateAppointments]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(date)}
              </h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {dateAppointments.map((appointment) => (
                    <div key={appointment.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Time */}
                          <div className="flex items-center gap-1 text-sm font-medium text-gray-900 min-w-[100px]">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                          </div>

                          {/* Doctor Badge */}
                          {appointment.doctor && (
                            <div
                              className={cn(
                                'px-3 py-1 rounded-full text-white text-sm font-medium',
                                appointment.doctor.color || 'bg-blue-500'
                              )}
                            >
                              {appointment.doctor.name}
                            </div>
                          )}

                          {/* Patient Info */}
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {appointment.patient?.name || 'Неизвестен пациент'}
                              </p>
                              <p className="text-sm text-gray-700">
                                {appointment.patient ? formatPhone(appointment.patient.phone) : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Type */}
                          {appointment.type && (
                            <span className="text-sm text-gray-700 hidden md:inline">
                              {appointment.type}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Status */}
                          <span className={cn(
                            'px-3 py-1 text-xs font-medium rounded-full',
                            statusColors[appointment.status] || statusColors.scheduled
                          )}>
                            {statusLabels[appointment.status] || appointment.status}
                          </span>

                          {/* Quick Actions */}
                          <div className="flex gap-1">
                            {appointment.status === 'scheduled' && (
                              <>
                                <button
                                  onClick={() => updateStatus(appointment.id, 'completed')}
                                  className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
                                >
                                  Завърши
                                </button>
                                <button
                                  onClick={() => updateStatus(appointment.id, 'no_show')}
                                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                >
                                  Неявил се
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openEditModal(appointment)}
                              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                            >
                              Редактирай
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Няма намерени часове</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingAppointment ? 'Редактирай час' : 'Нов час'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата *
                  </label>
                  <input
                    type="date"
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Статус
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Начало *
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Край *
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Лекар *
                </label>
                <select
                  value={formData.doctor_id}
                  onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Изберете лекар...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пациент *
                </label>
                <select
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Изберете пациент...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} ({formatPhone(patient.phone)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип на часа
                </label>
                <input
                  type="text"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="напр. Преглед, Почистване, Пломба..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цена (лв)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Бележки
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отказ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Запазване...' : editingAppointment ? 'Запази' : 'Създай'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
