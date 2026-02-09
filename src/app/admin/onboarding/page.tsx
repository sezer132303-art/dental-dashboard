'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  User,
  Calendar,
  MessageCircle,
  CheckCircle,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2
} from 'lucide-react'

interface OnboardingData {
  // Step 1: Clinic
  clinicName: string
  clinicAddress: string
  clinicPhone: string

  // Step 2: User
  userName: string
  userPhone: string
  userEmail: string
  userPassword: string

  // Step 3: Google Calendar
  googleCalendars: { name: string; calendarId: string }[]
  googleServiceAccount: string

  // Step 4: WhatsApp
  whatsappInstance: string
  whatsappApiKey: string
  evolutionApiUrl: string
}

const initialData: OnboardingData = {
  clinicName: '',
  clinicAddress: '',
  clinicPhone: '',
  userName: '',
  userPhone: '',
  userEmail: '',
  userPassword: '',
  googleCalendars: [{ name: '', calendarId: '' }],
  googleServiceAccount: '',
  whatsappInstance: '',
  whatsappApiKey: '',
  evolutionApiUrl: 'https://evo.settbg.com'
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [createdClinicId, setCreatedClinicId] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ phone: string; password: string } | null>(null)

  const steps = [
    { number: 1, title: 'Клиника', icon: Building2 },
    { number: 2, title: 'Потребител', icon: User },
    { number: 3, title: 'Google Calendar', icon: Calendar },
    { number: 4, title: 'WhatsApp', icon: MessageCircle },
  ]

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setData({ ...data, userPassword: password })
  }

  async function handleStep1() {
    if (!data.clinicName) {
      setError('Името на клиниката е задължително')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.clinicName,
          address: data.clinicAddress,
          phone: data.clinicPhone
        })
      })

      if (!response.ok) {
        throw new Error('Грешка при създаване на клиника')
      }

      const clinic = await response.json()
      setCreatedClinicId(clinic.id)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неочаквана грешка')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2() {
    if (!data.userName || !data.userPhone || !data.userPassword) {
      setError('Всички полета са задължителни')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/create-clinic-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.userName,
          phone: data.userPhone,
          email: data.userEmail,
          password: data.userPassword,
          clinicId: createdClinicId
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Грешка при създаване на потребител')
      }

      setCredentials({
        phone: data.userPhone,
        password: data.userPassword
      })
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неочаквана грешка')
    } finally {
      setLoading(false)
    }
  }

  function addCalendar() {
    setData({
      ...data,
      googleCalendars: [...data.googleCalendars, { name: '', calendarId: '' }]
    })
  }

  function removeCalendar(index: number) {
    setData({
      ...data,
      googleCalendars: data.googleCalendars.filter((_, i) => i !== index)
    })
  }

  function updateCalendar(index: number, field: 'name' | 'calendarId', value: string) {
    const updated = [...data.googleCalendars]
    updated[index][field] = value
    setData({ ...data, googleCalendars: updated })
  }

  async function handleStep3() {
    // Google Calendar is optional
    const validCalendars = data.googleCalendars.filter(c => c.calendarId.trim())
    if (validCalendars.length > 0 || data.googleServiceAccount) {
      setLoading(true)
      setError('')

      try {
        await fetch(`/api/clinics/${createdClinicId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            google_calendars: JSON.stringify(validCalendars),
            google_service_account: data.googleServiceAccount
          })
        })
      } catch (err) {
        console.error('Calendar update error:', err)
      } finally {
        setLoading(false)
      }
    }

    setStep(4)
  }

  async function handleStep4() {
    setLoading(true)
    setError('')

    try {
      await fetch(`/api/clinics/${createdClinicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_instance: data.whatsappInstance,
          whatsapp_api_key: data.whatsappApiKey,
          evolution_api_url: data.evolutionApiUrl
        })
      })

      // Success - go to completion
      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неочаквана грешка')
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                step > s.number
                  ? 'bg-green-500 border-green-500 text-white'
                  : step === s.number
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-400'
              }`}>
                {step > s.number ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <s.icon className="w-5 h-5" />
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-full h-1 mx-2 ${
                  step > s.number ? 'bg-green-500' : 'bg-gray-200'
                }`} style={{ width: '60px' }} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((s) => (
            <span key={s.number} className={`text-xs ${
              step >= s.number ? 'text-gray-900' : 'text-gray-400'
            }`}>
              {s.title}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Clinic */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Създай нова клиника</h2>
              <p className="text-gray-500 mt-1">Въведи основната информация за клиниката</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Име на клиниката *
                </label>
                <input
                  type="text"
                  value={data.clinicName}
                  onChange={(e) => setData({ ...data, clinicName: e.target.value })}
                  placeholder="Дентална Клиника София"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Адрес
                </label>
                <input
                  type="text"
                  value={data.clinicAddress}
                  onChange={(e) => setData({ ...data, clinicAddress: e.target.value })}
                  placeholder="ул. Витоша 100, София"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон на клиниката
                </label>
                <input
                  type="tel"
                  value={data.clinicPhone}
                  onChange={(e) => setData({ ...data, clinicPhone: e.target.value })}
                  placeholder="+359 2 123 4567"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>

            <button
              onClick={handleStep1}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Създаване...' : 'Създай клиника'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 2: User */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Създай потребител за клиниката</h2>
              <p className="text-gray-500 mt-1">Този потребител ще има достъп до клиника портала</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Име на потребителя *
                </label>
                <input
                  type="text"
                  value={data.userName}
                  onChange={(e) => setData({ ...data, userName: e.target.value })}
                  placeholder="Иван Иванов"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон (за вход) *
                </label>
                <input
                  type="tel"
                  value={data.userPhone}
                  onChange={(e) => setData({ ...data, userPhone: e.target.value })}
                  placeholder="0888 123 456"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={data.userEmail}
                  onChange={(e) => setData({ ...data, userEmail: e.target.value })}
                  placeholder="clinic@example.com"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Парола *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={data.userPassword}
                      onChange={(e) => setData({ ...data, userPassword: e.target.value })}
                      placeholder="Въведи парола"
                      className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Генерирай
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleStep2}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Създаване...' : 'Създай потребител'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 3: Google Calendar */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Google Calendar интеграция</h2>
              <p className="text-gray-500 mt-1">Свържи един или повече Google календари (опционално)</p>
            </div>

            <div className="space-y-4">
              {/* Multiple Calendars */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Календари
                  </label>
                  <button
                    type="button"
                    onClick={addCalendar}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Добави календар
                  </button>
                </div>

                <div className="space-y-3">
                  {data.googleCalendars.map((calendar, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          Календар {index + 1}
                        </span>
                        {data.googleCalendars.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCalendar(index)}
                            className="text-red-500 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={calendar.name}
                        onChange={(e) => updateCalendar(index, 'name', e.target.value)}
                        placeholder="Име (напр. Д-р Иванов)"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                      <input
                        type="text"
                        value={calendar.calendarId}
                        onChange={(e) => updateCalendar(index, 'calendarId', e.target.value)}
                        placeholder="Calendar ID (abc123@group.calendar.google.com)"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Намери Calendar ID в Google Calendar Settings → Calendar ID
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Account JSON
                </label>
                <textarea
                  value={data.googleServiceAccount}
                  onChange={(e) => setData({ ...data, googleServiceAccount: e.target.value })}
                  placeholder='{"type": "service_account", ...}'
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Един Service Account може да има достъп до множество календари
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(4)}
                className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Пропусни
              </button>
              <button
                onClick={handleStep3}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Запазване...' : 'Продължи'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: WhatsApp */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">WhatsApp интеграция</h2>
              <p className="text-gray-500 mt-1">Свържи WhatsApp чрез Evolution API</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evolution API URL
                </label>
                <input
                  type="url"
                  value={data.evolutionApiUrl}
                  onChange={(e) => setData({ ...data, evolutionApiUrl: e.target.value })}
                  placeholder="https://evo.example.com"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instance Name
                </label>
                <input
                  type="text"
                  value={data.whatsappInstance}
                  onChange={(e) => setData({ ...data, whatsappInstance: e.target.value })}
                  placeholder="clinic_sofia"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  value={data.whatsappApiKey}
                  onChange={(e) => setData({ ...data, whatsappApiKey: e.target.value })}
                  placeholder="your-api-key"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(5)}
                className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50"
              >
                Пропусни
              </button>
              <button
                onClick={handleStep4}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Запазване...' : 'Завърши настройка'}
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 5 && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900">Клиниката е готова!</h2>
              <p className="text-gray-500 mt-1">Всичко е настроено успешно</p>
            </div>

            {credentials && (
              <div className="bg-gray-50 rounded-lg p-4 text-left">
                <h3 className="font-medium text-gray-900 mb-3">Данни за вход:</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Телефон:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-white px-2 py-1 rounded border">{credentials.phone}</code>
                      <button
                        onClick={() => copyToClipboard(credentials.phone)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Парола:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-white px-2 py-1 rounded border">{credentials.password}</code>
                      <button
                        onClick={() => copyToClipboard(credentials.password)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Изпрати тези данни на клиента за достъп до портала
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(1)
                  setData(initialData)
                  setCreatedClinicId(null)
                  setCredentials(null)
                }}
                className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50"
              >
                Добави друга клиника
              </button>
              <button
                onClick={() => router.push('/admin/clinics')}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Към клиники
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
