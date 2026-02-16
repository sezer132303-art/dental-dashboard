'use client'

import { useEffect, useState } from 'react'
import { Users, Search, Phone, Calendar, CheckCircle, XCircle, X, Loader2, Edit2, Mail, FileText, ChevronDown } from 'lucide-react'

interface Patient {
  id: string
  phone: string
  name: string
  email?: string
  notes?: string
  first_contact_at: string
  last_contact_at: string
  total_appointments: number
  completed_appointments: number
  cancelled_appointments: number
  no_show_count: number
}

interface Appointment {
  id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: string
  type: string
  doctor_name?: string
}

const statusOptions = [
  { value: 'scheduled', label: 'Насрочен', color: 'bg-blue-500 text-white' },
  { value: 'confirmed', label: 'Потвърден', color: 'bg-indigo-500 text-white' },
  { value: 'completed', label: 'Завършен', color: 'bg-green-600 text-white' },
  { value: 'no_show', label: 'Неявяване', color: 'bg-orange-500 text-white' },
  { value: 'cancelled', label: 'Отменен', color: 'bg-red-500 text-white' }
]

export default function ClinicPatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    notes: ''
  })
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null)
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null)

  useEffect(() => {
    fetchPatients()
  }, [])

  async function fetchPatients() {
    try {
      const response = await fetch('/api/clinic/patients')
      if (response.ok) {
        const data = await response.json()
        setPatients(data.patients || [])
      }
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPatientAppointments(patientId: string) {
    setLoadingAppointments(true)
    try {
      const response = await fetch(`/api/clinic/patients/${patientId}/appointments`)
      if (response.ok) {
        const data = await response.json()
        setAppointments(data.appointments || [])
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoadingAppointments(false)
    }
  }

  function handlePatientClick(patient: Patient) {
    setSelectedPatient(patient)
    setEditForm({
      name: patient.name || '',
      email: patient.email || '',
      notes: patient.notes || ''
    })
    setEditMode(false)
    setShowModal(true)
    fetchPatientAppointments(patient.id)
  }

  async function handleSavePatient() {
    if (!selectedPatient) return
    setSaving(true)

    try {
      const response = await fetch(`/api/clinic/patients/${selectedPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (response.ok) {
        setPatients(patients.map(p =>
          p.id === selectedPatient.id
            ? { ...p, ...editForm }
            : p
        ))
        setSelectedPatient({ ...selectedPatient, ...editForm })
        setEditMode(false)
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

  async function handleAppointmentStatusChange(appointmentId: string, newStatus: string) {
    setUpdatingAppointmentId(appointmentId)
    setOpenStatusDropdown(null)

    try {
      const response = await fetch(`/api/clinic/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        // Update local state
        setAppointments(appointments.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: newStatus }
            : apt
        ))

        // Refresh patient stats
        if (selectedPatient) {
          fetchPatients()
        }
      } else {
        const data = await response.json()
        alert(data.error || 'Грешка при промяна на статуса')
      }
    } catch (error) {
      console.error('Status update error:', error)
      alert('Грешка при промяна на статуса')
    } finally {
      setUpdatingAppointmentId(null)
    }
  }

  const filteredPatients = patients.filter(patient =>
    patient.name?.toLowerCase().includes(search.toLowerCase()) ||
    patient.phone?.includes(search)
  )

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('bg-BG')
  }

  const formatTime = (timeStr: string) => {
    return timeStr?.substring(0, 5) || ''
  }

  const getStatusLabel = (status: string) => {
    const option = statusOptions.find(o => o.value === status)
    return option?.label || status
  }

  const getStatusColor = (status: string) => {
    const option = statusOptions.find(o => o.value === status)
    return option?.color || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Пациенти</h1>
        <p className="text-gray-500">Списък с всички пациенти на клиниката</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Търсене по име или телефон..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
          />
        </div>
      </div>

      {/* Patients grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Няма намерени пациенти</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <div
              key={patient.id}
              onClick={() => handlePatientClick(patient)}
              className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-semibold text-teal-700">
                    {(patient.name || patient.phone).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {patient.name || 'Неизвестен'}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <Phone className="w-3 h-3" />
                    <span>{patient.phone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-blue-600">
                    <Calendar className="w-4 h-4" />
                    <span className="font-semibold">{patient.total_appointments}</span>
                  </div>
                  <p className="text-xs text-gray-500">Часове</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-semibold">{patient.completed_appointments}</span>
                  </div>
                  <p className="text-xs text-gray-500">Завършени</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span className="font-semibold">{patient.no_show_count}</span>
                  </div>
                  <p className="text-xs text-gray-500">Неявяване</p>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-400">
                Последен контакт: {new Date(patient.last_contact_at).toLocaleDateString('bg-BG')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Patient Detail Modal */}
      {showModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-teal-700">
                    {(selectedPatient.name || selectedPatient.phone).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedPatient.name || 'Неизвестен'}
                  </h2>
                  <p className="text-gray-500">{selectedPatient.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    title="Редактиране"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowModal(false)
                    setEditMode(false)
                    setOpenStatusDropdown(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Status Actions - показва се само ако има насрочен/потвърден час */}
            {appointments.some(apt => apt.status === 'scheduled' || apt.status === 'confirmed') && (
              <div className="px-6 py-3 bg-gray-50 border-b flex items-center gap-3">
                <span className="text-sm text-gray-600">Бързи действия:</span>
                {(() => {
                  const activeApt = appointments.find(apt => apt.status === 'scheduled' || apt.status === 'confirmed')
                  if (!activeApt) return null
                  return (
                    <>
                      <button
                        onClick={() => handleAppointmentStatusChange(activeApt.id, 'completed')}
                        disabled={updatingAppointmentId === activeApt.id}
                        className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 shadow-sm"
                      >
                        {updatingAppointmentId === activeApt.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Завършен
                      </button>
                      <button
                        onClick={() => handleAppointmentStatusChange(activeApt.id, 'no_show')}
                        disabled={updatingAppointmentId === activeApt.id}
                        className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 shadow-sm"
                      >
                        {updatingAppointmentId === activeApt.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Неявяване
                      </button>
                      <button
                        onClick={() => handleAppointmentStatusChange(activeApt.id, 'cancelled')}
                        disabled={updatingAppointmentId === activeApt.id}
                        className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 shadow-sm"
                      >
                        {updatingAppointmentId === activeApt.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Отменен
                      </button>
                      <span className="text-xs text-gray-400 ml-2">
                        за {formatDate(activeApt.appointment_date)} в {formatTime(activeApt.start_time)}
                      </span>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{selectedPatient.total_appointments}</p>
                  <p className="text-xs text-gray-600">Общо часове</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{selectedPatient.completed_appointments}</p>
                  <p className="text-xs text-gray-600">Завършени</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{selectedPatient.cancelled_appointments}</p>
                  <p className="text-xs text-gray-600">Отменени</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{selectedPatient.no_show_count}</p>
                  <p className="text-xs text-gray-600">Неявявания</p>
                </div>
              </div>

              {/* Edit Form or Details */}
              {editMode ? (
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900">Редактиране</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Име</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Имейл</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Бележки</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditMode(false)}
                      className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100"
                    >
                      Отказ
                    </button>
                    <button
                      onClick={handleSavePatient}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Запази
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedPatient.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{selectedPatient.email}</span>
                    </div>
                  )}
                  {selectedPatient.notes && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <FileText className="w-4 h-4 mt-0.5" />
                      <span>{selectedPatient.notes}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    Регистриран: {formatDate(selectedPatient.first_contact_at)}
                  </div>
                </div>
              )}

              {/* Appointments History with Status Change */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">История на часовете</h3>
                {loadingAppointments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                  </div>
                ) : appointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Няма записани часове</p>
                ) : (
                  <div className="space-y-2">
                    {appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatDate(apt.appointment_date)} в {formatTime(apt.start_time)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {apt.type} {apt.doctor_name && `• ${apt.doctor_name}`}
                          </p>
                        </div>

                        {/* Status Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenStatusDropdown(openStatusDropdown === apt.id ? null : apt.id)}
                            disabled={updatingAppointmentId === apt.id}
                            className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition ${getStatusColor(apt.status)} ${updatingAppointmentId === apt.id ? 'opacity-50' : 'hover:opacity-80'}`}
                          >
                            {updatingAppointmentId === apt.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                {getStatusLabel(apt.status)}
                                <ChevronDown className="w-3 h-3" />
                              </>
                            )}
                          </button>

                          {openStatusDropdown === apt.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-10 py-1 min-w-[180px]">
                              {statusOptions.map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => handleAppointmentStatusChange(apt.id, option.value)}
                                  className={`w-full px-3 py-2.5 text-left text-sm font-medium hover:bg-gray-100 flex items-center gap-3 ${apt.status === option.value ? 'bg-blue-50' : ''}`}
                                >
                                  <span className={`w-3 h-3 rounded-full ${option.color.split(' ')[0]}`}></span>
                                  <span className="text-gray-800">{option.label}</span>
                                  {apt.status === option.value && (
                                    <CheckCircle className="w-4 h-4 ml-auto text-green-600" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
