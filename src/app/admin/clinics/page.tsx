'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Search, Edit, Trash2, X, User, Calendar, Key, Phone, RefreshCw, MessageCircle } from 'lucide-react'

interface Clinic {
  id: string
  name: string
  whatsapp_instance: string | null
  doctors: number
  patients: number
  appointments: number
}

interface DoctorEntry {
  id?: string
  name: string
  specialty: string
  calendar_id: string
}

const emptyDoctor: DoctorEntry = {
  name: '',
  specialty: 'Зъболекар',
  calendar_id: ''
}

export default function AdminClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    whatsapp_instance: '',
    whatsapp_api_key: '',
    evolution_api_url: 'https://evo.settbg.com',
    google_calendar_id: '',
    // Admin user fields
    admin_phone: '',
    admin_password: '',
    admin_name: ''
  })
  const [doctors, setDoctors] = useState<DoctorEntry[]>([{ ...emptyDoctor }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [syncingClinicId, setSyncingClinicId] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ clinicId: string; message: string; success: boolean } | null>(null)

  useEffect(() => {
    fetchClinics()
  }, [])

  async function fetchClinics() {
    try {
      const response = await fetch('/api/clinics')
      if (response.ok) {
        const data = await response.json()
        setClinics(data)
      }
    } catch (error) {
      console.error('Failed to fetch clinics:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredClinics = clinics.filter(clinic =>
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalDoctors = clinics.reduce((sum, c) => sum + c.doctors, 0)
  const totalPatients = clinics.reduce((sum, c) => sum + c.patients, 0)
  const totalAppointments = clinics.reduce((sum, c) => sum + c.appointments, 0)

  function openAddModal() {
    setEditingClinic(null)
    setError('')
    setFormData({
      name: '',
      address: '',
      phone: '',
      whatsapp_instance: '',
      whatsapp_api_key: '',
      evolution_api_url: 'https://evo.settbg.com',
      google_calendar_id: '',
      admin_phone: '',
      admin_password: '',
      admin_name: ''
    })
    setDoctors([{ ...emptyDoctor }])
    setShowModal(true)
  }

  async function openEditModal(clinic: Clinic) {
    setEditingClinic(clinic)
    setError('')
    try {
      const response = await fetch(`/api/clinics/${clinic.id}`)
      if (response.ok) {
        const fullClinic = await response.json()
        setFormData({
          name: fullClinic.name || '',
          address: fullClinic.address || '',
          phone: fullClinic.phone || '',
          whatsapp_instance: fullClinic.whatsapp_instance || '',
          whatsapp_api_key: fullClinic.whatsapp_api_key || '',
          evolution_api_url: fullClinic.evolution_api_url || 'https://evo.settbg.com',
          google_calendar_id: fullClinic.google_calendar_id || '',
          admin_phone: fullClinic.admin?.phone || '',
          admin_password: '',
          admin_name: fullClinic.admin?.name || ''
        })
        // Load existing doctors
        if (fullClinic.doctors && fullClinic.doctors.length > 0) {
          setDoctors(fullClinic.doctors.map((d: any) => ({
            id: d.id,
            name: d.name || '',
            specialty: d.specialty || 'Зъболекар',
            calendar_id: d.calendar_id || ''
          })))
        } else {
          setDoctors([{ ...emptyDoctor }])
        }
      } else {
        setFormData({
          name: clinic.name,
          address: '',
          phone: '',
          whatsapp_instance: clinic.whatsapp_instance || '',
          whatsapp_api_key: '',
          evolution_api_url: 'https://evo.settbg.com',
          google_calendar_id: '',
          admin_phone: '',
          admin_password: '',
          admin_name: ''
        })
        setDoctors([{ ...emptyDoctor }])
      }
    } catch {
      setFormData({
        name: clinic.name,
        address: '',
        phone: '',
        whatsapp_instance: clinic.whatsapp_instance || '',
        whatsapp_api_key: '',
        evolution_api_url: 'https://evo.settbg.com',
        google_calendar_id: '',
        admin_phone: '',
        admin_password: '',
        admin_name: ''
      })
      setDoctors([{ ...emptyDoctor }])
    }
    setShowModal(true)
  }

  function addDoctor() {
    setDoctors([...doctors, { ...emptyDoctor }])
  }

  function removeDoctor(index: number) {
    if (doctors.length > 1) {
      setDoctors(doctors.filter((_, i) => i !== index))
    }
  }

  function updateDoctor(index: number, field: keyof DoctorEntry, value: string) {
    const updated = [...doctors]
    updated[index] = { ...updated[index], [field]: value }
    setDoctors(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Validate at least one doctor with name
    const validDoctors = doctors.filter(d => d.name.trim())
    if (validDoctors.length === 0) {
      setError('Моля, добавете поне един лекар')
      setSaving(false)
      return
    }

    // Validate admin fields for new clinic
    if (!editingClinic) {
      if (!formData.admin_name.trim()) {
        setError('Моля, въведете име на администратора')
        setSaving(false)
        return
      }
      if (!formData.admin_phone.trim()) {
        setError('Моля, въведете телефон за вход')
        setSaving(false)
        return
      }
      if (!formData.admin_password || formData.admin_password.length < 6) {
        setError('Паролата трябва да е поне 6 символа')
        setSaving(false)
        return
      }
    }

    try {
      const url = editingClinic ? `/api/clinics/${editingClinic.id}` : '/api/clinics'
      const method = editingClinic ? 'PATCH' : 'POST'

      // Combine all calendar IDs from doctors
      const allCalendarIds = doctors
        .filter(d => d.calendar_id.trim())
        .map(d => d.calendar_id.trim())
        .join('\n')

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          google_calendar_id: allCalendarIds || formData.google_calendar_id,
          doctors: validDoctors.map(d => ({
            id: d.id,
            name: d.name.trim(),
            specialty: d.specialty,
            calendar_id: d.calendar_id.trim()
          }))
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Check if admin operation had issues
        if (data.adminResult && !data.adminResult.success) {
          setError(`Клиниката е запазена, но: ${data.adminResult.error || 'Грешка с админ акаунта'}`)
        } else {
          setShowModal(false)
          fetchClinics()
        }
      } else {
        setError(data.error || 'Грешка при запазване')
      }
    } catch (err) {
      console.error('Save error:', err)
      setError('Грешка при свързване със сървъра')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(clinicId: string) {
    if (!confirm('Сигурни ли сте, че искате да изтриете тази клиника?')) return

    try {
      const response = await fetch(`/api/clinics/${clinicId}`, { method: 'DELETE' })
      if (response.ok) {
        fetchClinics()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  async function handleSyncWhatsApp(clinicId: string, clinicName: string) {
    setSyncingClinicId(clinicId)
    setSyncResult(null)

    try {
      const response = await fetch('/api/admin/sync-evolution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer cleanup-demo-2026'
        },
        body: JSON.stringify({ clinicId })
      })

      const data = await response.json()

      if (response.ok) {
        setSyncResult({
          clinicId,
          message: data.message || 'Синхронизацията е успешна!',
          success: true
        })
      } else {
        setSyncResult({
          clinicId,
          message: data.error || data.details || 'Грешка при синхронизация',
          success: false
        })
      }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncResult({
        clinicId,
        message: 'Грешка при свързване със сървъра',
        success: false
      })
    } finally {
      setSyncingClinicId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Търси клиника..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          />
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Добави клиника
        </button>
      </div>

      {/* Clinics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClinics.map((clinic) => (
          <div key={clinic.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{clinic.name}</h3>
                  <p className="text-sm text-gray-500">{clinic.whatsapp_instance || 'Няма WhatsApp'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {clinic.whatsapp_instance && (
                  <button
                    onClick={() => handleSyncWhatsApp(clinic.id, clinic.name)}
                    disabled={syncingClinicId === clinic.id}
                    className="p-2 hover:bg-green-50 rounded-lg disabled:opacity-50"
                    title="Синхронизирай WhatsApp"
                  >
                    <RefreshCw className={`w-4 h-4 text-green-500 ${syncingClinicId === clinic.id ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button
                  onClick={() => openEditModal(clinic)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Edit className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => handleDelete(clinic.id)}
                  className="p-2 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{clinic.doctors}</p>
                <p className="text-xs text-gray-500">Лекари</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{clinic.patients}</p>
                <p className="text-xs text-gray-500">Пациенти</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{clinic.appointments}</p>
                <p className="text-xs text-gray-500">Часове</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredClinics.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Няма намерени клиники</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Общо статистика</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-3xl font-bold text-gray-900">{clinics.length}</p>
            <p className="text-sm text-gray-500">Общо клиники</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{totalDoctors}</p>
            <p className="text-sm text-gray-500">Общо лекари</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{totalPatients}</p>
            <p className="text-sm text-gray-500">Активни пациенти</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{totalAppointments.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Общо часове</p>
          </div>
        </div>
      </div>

      {/* Sync Result Toast */}
      {syncResult && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-md z-50 ${
          syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              syncResult.success ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {syncResult.success ? (
                <MessageCircle className="w-4 h-4 text-green-600" />
              ) : (
                <X className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${syncResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {syncResult.success ? 'WhatsApp синхронизация' : 'Грешка'}
              </p>
              <p className={`text-sm ${syncResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {syncResult.message}
              </p>
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="p-1 hover:bg-white/50 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingClinic ? 'Редактирай клиника' : 'Добави клиника'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">Основна информация</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Име на клиниката *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Адрес
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="ул. Витоша 100, София"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+359 2 123 4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              {/* Admin Account Section */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Администраторски акаунт
                </h3>
                <p className="text-sm text-gray-500">
                  {editingClinic
                    ? 'Редактирайте данните за вход на собственика на клиниката.'
                    : 'Създайте акаунт за собственика на клиниката, с който ще влиза в системата.'
                  }
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Име на администратора *
                  </label>
                  <input
                    type="text"
                    value={formData.admin_name}
                    onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                    placeholder="Иван Иванов"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        Телефон за вход *
                      </span>
                    </label>
                    <input
                      type="tel"
                      value={formData.admin_phone}
                      onChange={(e) => setFormData({ ...formData, admin_phone: e.target.value })}
                      placeholder="0888 123 456"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      required
                    />
                    {editingClinic && !formData.admin_phone && (
                      <p className="text-xs text-orange-500 mt-1">Въведете телефон за създаване на админ</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="flex items-center gap-1">
                        <Key className="w-3 h-3" />
                        {editingClinic ? 'Парола' : 'Парола *'}
                      </span>
                    </label>
                    <input
                      type="password"
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      placeholder={editingClinic ? 'Въведете нова парола' : 'Минимум 6 символа'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      required={!editingClinic}
                      minLength={6}
                    />
                    {editingClinic && (
                      <p className="text-xs text-gray-400 mt-1">Въведете нова парола за да я промените</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Doctors Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-medium text-gray-900">Лекари</h3>
                  <button
                    type="button"
                    onClick={addDoctor}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Добави лекар
                  </button>
                </div>

                {doctors.map((doctor, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Лекар {index + 1}
                      </span>
                      {doctors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDoctor(index)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Име *
                        </label>
                        <input
                          type="text"
                          value={doctor.name}
                          onChange={(e) => updateDoctor(index, 'name', e.target.value)}
                          placeholder="д-р Иван Иванов"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Специалност
                        </label>
                        <select
                          value={doctor.specialty}
                          onChange={(e) => updateDoctor(index, 'specialty', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
                        >
                          <option value="Зъболекар">Зъболекар</option>
                          <option value="Ортодонт">Ортодонт</option>
                          <option value="Орален хирург">Орален хирург</option>
                          <option value="Ендодонт">Ендодонт</option>
                          <option value="Пародонтолог">Пародонтолог</option>
                          <option value="Детски зъболекар">Детски зъболекар</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Google Calendar ID
                      </label>
                      <input
                        type="text"
                        value={doctor.calendar_id}
                        onChange={(e) => updateDoctor(index, 'calendar_id', e.target.value)}
                        placeholder="calendar@group.calendar.google.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
                      />
                    </div>
                  </div>
                ))}

                <p className="text-xs text-gray-500">
                  Всеки лекар може да има собствен Google Calendar за синхронизация на часове.
                </p>
              </div>

              {/* WhatsApp */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">WhatsApp интеграция</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evolution API URL
                  </label>
                  <input
                    type="url"
                    value={formData.evolution_api_url}
                    onChange={(e) => setFormData({ ...formData, evolution_api_url: e.target.value })}
                    placeholder="https://evo.example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Instance Name
                    </label>
                    <input
                      type="text"
                      value={formData.whatsapp_instance}
                      onChange={(e) => setFormData({ ...formData, whatsapp_instance: e.target.value })}
                      placeholder="clinic_sofia"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="text"
                      value={formData.whatsapp_api_key}
                      onChange={(e) => setFormData({ ...formData, whatsapp_api_key: e.target.value })}
                      placeholder="your-api-key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Отказ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Запазване...' : 'Запази'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
