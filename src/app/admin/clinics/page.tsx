'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Search, Edit, Trash2, X } from 'lucide-react'

interface Clinic {
  id: string
  name: string
  whatsapp_instance: string | null
  doctors: number
  patients: number
  appointments: number
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
    google_calendars: ''
  })
  const [saving, setSaving] = useState(false)

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
    setFormData({
      name: '',
      address: '',
      phone: '',
      whatsapp_instance: '',
      whatsapp_api_key: '',
      evolution_api_url: 'https://evo.settbg.com',
      google_calendars: ''
    })
    setShowModal(true)
  }

  async function openEditModal(clinic: Clinic) {
    setEditingClinic(clinic)
    // Fetch full clinic details
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
          google_calendars: fullClinic.google_calendars || ''
        })
      } else {
        setFormData({
          name: clinic.name,
          address: '',
          phone: '',
          whatsapp_instance: clinic.whatsapp_instance || '',
          whatsapp_api_key: '',
          evolution_api_url: 'https://evo.settbg.com',
          google_calendars: ''
        })
      }
    } catch {
      setFormData({
        name: clinic.name,
        address: '',
        phone: '',
        whatsapp_instance: clinic.whatsapp_instance || '',
        whatsapp_api_key: '',
        evolution_api_url: 'https://evo.settbg.com',
        google_calendars: ''
      })
    }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingClinic ? `/api/clinics/${editingClinic.id}` : '/api/clinics'
      const method = editingClinic ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setShowModal(false)
        fetchClinics()
      }
    } catch (error) {
      console.error('Save error:', error)
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingClinic ? 'Редактирай клиника' : 'Добави клиника'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
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

              {/* Google Calendar */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">Google Calendar</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calendar IDs (JSON формат)
                  </label>
                  <textarea
                    value={formData.google_calendars}
                    onChange={(e) => setFormData({ ...formData, google_calendars: e.target.value })}
                    placeholder='[{"name": "Д-р Иванов", "calendarId": "abc@group.calendar.google.com"}]'
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Синхронизацията се извършва чрез n8n
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
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
