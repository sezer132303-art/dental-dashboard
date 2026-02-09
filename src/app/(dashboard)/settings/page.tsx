'use client'

import { useState } from 'react'
import { Save, Bell, Clock, Globe, Loader2, Check } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    clinicName: 'Дентална Клиника',
    timezone: 'Europe/Sofia',
    reminder24h: true,
    reminder3h: true,
    workingHoursStart: '09:00',
    workingHoursEnd: '21:00',
    saturdayEnd: '15:00',
    sundayClosed: true
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      // In a full implementation, this would save to the database
      await new Promise(resolve => setTimeout(resolve, 500))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Save error:', error)
      alert('Грешка при запазване на настройките')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Clinic Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Информация за клиниката
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Име на клиниката</label>
            <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Часова зона</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Europe/Sofia">Europe/Sofia (UTC+2/+3)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Working Hours */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Работно време
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Начало (Пон-Пет)</label>
              <input
                type="time"
                value={settings.workingHoursStart}
                onChange={(e) => setSettings({ ...settings, workingHoursStart: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Край (Пон-Пет)</label>
              <input
                type="time"
                value={settings.workingHoursEnd}
                onChange={(e) => setSettings({ ...settings, workingHoursEnd: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Край (Събота)</label>
            <input
              type="time"
              value={settings.saturdayEnd}
              onChange={(e) => setSettings({ ...settings, saturdayEnd: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sundayClosed"
              checked={settings.sundayClosed}
              onChange={(e) => setSettings({ ...settings, sundayClosed: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="sundayClosed" className="text-sm text-gray-700">Неделя - затворено</label>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Напомняния
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Напомняне 24 часа преди</p>
              <p className="text-sm text-gray-500">Изпращане на WhatsApp съобщение 24 часа преди часа</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, reminder24h: !settings.reminder24h })}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.reminder24h ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.reminder24h ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Напомняне 3 часа преди</p>
              <p className="text-sm text-gray-500">Изпращане на WhatsApp съобщение 3 часа преди часа</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, reminder3h: !settings.reminder3h })}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.reminder3h ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.reminder3h ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
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
