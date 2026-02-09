'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Users, Calendar } from 'lucide-react'

export default function ExportsPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  async function downloadExport(type: 'appointments' | 'patients' | 'report') {
    setLoading(type)
    try {
      const params = new URLSearchParams({
        format: 'csv',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })

      const response = await fetch(`/api/exports/${type}?${params}`)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `${type}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert('Грешка при сваляне на файла')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Експорт на данни</h1>
        <p className="text-gray-600 mt-1">Свалете данни във CSV формат</p>
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Период за експорт</h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">От дата</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">До дата</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Appointments Export */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Часове</h3>
              <p className="text-sm text-gray-500">Всички записани часове</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Експортира всички часове с информация за пациенти, лекари, дати и статуси.
          </p>
          <button
            onClick={() => downloadExport('appointments')}
            disabled={loading === 'appointments'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading === 'appointments' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Свали CSV
              </>
            )}
          </button>
        </div>

        {/* Patients Export */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Пациенти</h3>
              <p className="text-sm text-gray-500">Списък с пациенти</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Експортира всички пациенти с контактна информация и данни за регистрация.
          </p>
          <button
            onClick={() => downloadExport('patients')}
            disabled={loading === 'patients'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading === 'patients' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Свали CSV
              </>
            )}
          </button>
        </div>

        {/* Report Export */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Отчет</h3>
              <p className="text-sm text-gray-500">Обобщен отчет</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Генерира обобщен отчет с ключови метрики - часове, приходи, пациенти.
          </p>
          <button
            onClick={() => downloadExport('report')}
            disabled={loading === 'report'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {loading === 'report' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Свали отчет
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
        <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800 font-medium">CSV формат</p>
          <p className="text-sm text-blue-700">
            Файловете са в CSV формат и могат да бъдат отворени с Excel, Google Sheets или друга програма за таблици.
          </p>
        </div>
      </div>
    </div>
  )
}
