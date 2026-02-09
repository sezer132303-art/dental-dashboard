'use client'

import { useEffect, useState } from 'react'
import { Search, User, Phone, Calendar, Loader2, Plus, Mail, X } from 'lucide-react'

interface Patient {
  id: string
  name: string
  phone: string
  email: string | null
  date_of_birth: string | null
  gender: string | null
  notes: string | null
  created_at: string
}

const initialFormData = {
  name: '',
  phone: '',
  email: '',
  date_of_birth: '',
  gender: '',
  notes: ''
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [saving, setSaving] = useState(false)

  async function fetchPatients() {
    try {
      const response = await fetch('/api/patients')
      const data = await response.json()

      if (data.patients) {
        setPatients(data.patients)
      }
    } catch (err) {
      console.error('Error fetching patients:', err)
      setError('Грешка при зареждане на пациенти')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, [])

  // Search with debounce
  useEffect(() => {
    if (!searchQuery) {
      fetchPatients()
      return
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/patients?search=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        if (data.patients) {
          setPatients(data.patients)
        }
      } catch (err) {
        console.error('Search error:', err)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const formatPhone = (phone: string) => {
    // Format 359888123456 to +359 888 123 456
    if (phone.startsWith('359')) {
      return `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`
    }
    return phone
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('bg-BG')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      // Format phone to 359XXXXXXXXX format
      let phone = formData.phone.replace(/\s+/g, '').replace(/^\+/, '')
      if (phone.startsWith('0')) {
        phone = '359' + phone.slice(1)
      } else if (!phone.startsWith('359')) {
        phone = '359' + phone
      }

      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phone,
          email: formData.email || null,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          notes: formData.notes || null
        })
      })

      if (response.ok) {
        setShowModal(false)
        setFormData(initialFormData)
        fetchPatients()
      } else {
        const data = await response.json()
        alert(data.error || 'Грешка при създаване на пациент')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Грешка при създаване на пациент')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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
      {/* Header with search and add button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Търси по име или телефон..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Нов пациент</span>
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Общо пациенти</p>
            <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
          </div>
        </div>
      </div>

      {/* Patient Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.map((patient) => (
          <div key={patient.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{patient.name}</h3>
                <div className="flex items-center gap-1 text-sm text-gray-900 mt-1">
                  <Phone className="w-4 h-4 text-gray-500" />
                  {formatPhone(patient.phone)}
                </div>
                {patient.email && (
                  <div className="flex items-center gap-1 text-sm text-gray-900 mt-1">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="truncate">{patient.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Пол:</span>
                <span className="font-medium text-gray-900">
                  {patient.gender === 'male' ? 'Мъж' : patient.gender === 'female' ? 'Жена' : '-'}
                </span>
              </div>
              {patient.date_of_birth && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">Дата на раждане:</span>
                  <span className="font-medium text-gray-900">{formatDate(patient.date_of_birth)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-1 text-xs text-gray-600">
              <Calendar className="w-3 h-3" />
              Регистриран: {formatDate(patient.created_at)}
            </div>
          </div>
        ))}
      </div>

      {patients.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Няма намерени пациенти</p>
        </div>
      )}

      {/* Add Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Нов пациент</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Име *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0888 123 456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имейл
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата на раждане
                </label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пол
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Изберете...</option>
                  <option value="male">Мъж</option>
                  <option value="female">Жена</option>
                </select>
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
                  {saving ? 'Запазване...' : 'Създай'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
