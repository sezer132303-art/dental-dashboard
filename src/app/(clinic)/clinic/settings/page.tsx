'use client'

import { useEffect, useState } from 'react'
import {
  Save,
  Bell,
  Clock,
  Globe,
  Loader2,
  Check,
  MessageCircle,
  Calendar,
  Stethoscope,
  Building2,
  Phone,
  MapPin,
  Key,
  Link,
  Users,
  CalendarDays
} from 'lucide-react'

interface Doctor {
  id: string
  name: string
  specialty: string | null
  calendar_id: string | null
  is_active: boolean
}

interface ClinicProfile {
  id: string
  name: string
  address: string | null
  phone: string | null
  whatsapp_instance: string | null
  whatsapp_api_key: string | null
  evolution_api_url: string | null
  google_calendar_id: string | null
  google_calendars: any
  google_service_account: any
  doctors: Doctor[]
  patientsCount: number
  appointmentsCount: number
  admin: {
    id: string
    name: string | null
    phone: string
  }
}

export default function ClinicSettingsPage() {
  const [profile, setProfile] = useState<ClinicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    whatsapp_instance: '',
    whatsapp_api_key: '',
    evolution_api_url: '',
    google_calendar_id: ''
  })

  // Notification settings (local only for now)
  const [notifications, setNotifications] = useState({
    reminder24h: true,
    reminder3h: true
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    try {
      const response = await fetch('/api/clinic/profile')
      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }
      const data = await response.json()
      setProfile(data)
      setFormData({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        whatsapp_instance: data.whatsapp_instance || '',
        whatsapp_api_key: data.whatsapp_api_key || '',
        evolution_api_url: data.evolution_api_url || '',
        google_calendar_id: data.google_calendar_id || ''
      })
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Грешка при зареждане на профила')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/clinic/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updatedProfile = await response.json()
      setProfile(prev => prev ? { ...prev, ...updatedProfile } : null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Грешка при запазване на настройките')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Stethoscope className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{profile?.doctors?.length || 0}</p>
              <p className="text-sm text-gray-500">Лекари</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{profile?.patientsCount || 0}</p>
              <p className="text-sm text-gray-500">Пациенти</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CalendarDays className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{profile?.appointmentsCount || 0}</p>
              <p className="text-sm text-gray-500">Часове</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formData.whatsapp_instance ? 'Да' : 'Не'}
              </p>
              <p className="text-sm text-gray-500">WhatsApp</p>
            </div>
          </div>
        </div>
      </div>

      {/* Clinic Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal-600" />
          Информация за клиниката
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Globe className="w-4 h-4 inline mr-1" />
              Име на клиниката
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Phone className="w-4 h-4 inline mr-1" />
              Телефон
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Адрес
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* WhatsApp Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-600" />
          WhatsApp настройки
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instance Name
            </label>
            <input
              type="text"
              value={formData.whatsapp_instance}
              onChange={(e) => setFormData({ ...formData, whatsapp_instance: e.target.value })}
              placeholder="напр. clinic-whatsapp"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Key className="w-4 h-4 inline mr-1" />
              API Key
            </label>
            <input
              type="password"
              value={formData.whatsapp_api_key}
              onChange={(e) => setFormData({ ...formData, whatsapp_api_key: e.target.value })}
              placeholder="API ключ за Evolution API"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Link className="w-4 h-4 inline mr-1" />
              Evolution API URL
            </label>
            <input
              type="text"
              value={formData.evolution_api_url}
              onChange={(e) => setFormData({ ...formData, evolution_api_url: e.target.value })}
              placeholder="https://api.example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Google Calendar Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Google Calendar настройки
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Calendar ID
          </label>
          <input
            type="text"
            value={formData.google_calendar_id}
            onChange={(e) => setFormData({ ...formData, google_calendar_id: e.target.value })}
            placeholder="calendar@group.calendar.google.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
          />
          <p className="mt-1 text-sm text-gray-500">
            Това е ID на Google Calendar, от който се синхронизират часовете
          </p>
        </div>
      </div>

      {/* Doctors List */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-teal-600" />
          Лекари ({profile?.doctors?.length || 0})
        </h3>
        {profile?.doctors && profile.doctors.length > 0 ? (
          <div className="space-y-3">
            {profile.doctors.filter(d => d.is_active).map((doctor) => (
              <div
                key={doctor.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                    {doctor.name.split(' ')[1]?.charAt(0) || doctor.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{doctor.name}</p>
                    <p className="text-sm text-gray-500">{doctor.specialty || 'Общ стоматолог'}</p>
                  </div>
                </div>
                {doctor.calendar_id && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Календар свързан
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">Няма добавени лекари</p>
        )}
        <p className="mt-3 text-sm text-gray-500">
          За да добавите или редактирате лекари, моля свържете се с администратор.
        </p>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-teal-600" />
          Напомняния
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Напомняне 24 часа преди</p>
              <p className="text-sm text-gray-500">Изпращане на WhatsApp съобщение 24 часа преди часа</p>
            </div>
            <button
              onClick={() => setNotifications({ ...notifications, reminder24h: !notifications.reminder24h })}
              className={`relative w-12 h-6 rounded-full transition-colors ${notifications.reminder24h ? 'bg-teal-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.reminder24h ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Напомняне 3 часа преди</p>
              <p className="text-sm text-gray-500">Изпращане на WhatsApp съобщение 3 часа преди часа</p>
            </div>
            <button
              onClick={() => setNotifications({ ...notifications, reminder3h: !notifications.reminder3h })}
              className={`relative w-12 h-6 rounded-full transition-colors ${notifications.reminder3h ? 'bg-teal-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.reminder3h ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Admin Info */}
      {profile?.admin && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-600">
            <strong>Администратор:</strong> {profile.admin.name || 'Не е зададено'} ({profile.admin.phone})
          </p>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-teal-700 focus:ring-4 focus:ring-teal-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : saved ? (
          <Check className="w-5 h-5" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        {saving ? 'Запазване...' : saved ? 'Запазено!' : 'Запази настройките'}
      </button>
    </div>
  )
}
