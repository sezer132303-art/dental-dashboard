'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'

interface ReportData {
  period: string
  totalAppointments: number
  completedAppointments: number
  cancelledAppointments: number
  noShows: number
  newPatients: number
  attendanceRate: number
  previousAttendanceRate: number
  appointmentsByDay: { day: string; count: number }[]
  appointmentsByService: { service: string; count: number }[]
}

export default function ClinicReports() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  useEffect(() => {
    fetchReportData()
  }, [period])

  async function fetchReportData() {
    try {
      setLoading(true)
      const response = await fetch(`/api/clinic/reports?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  const attendanceChange = reportData
    ? reportData.attendanceRate - reportData.previousAttendanceRate
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Отчети</h1>
          <p className="text-gray-500">Статистика и анализ на дейността</p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm">
          {['week', 'month', 'quarter'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-teal-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p === 'week' ? 'Седмица' : p === 'month' ? 'Месец' : 'Тримесечие'}
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{reportData?.totalAppointments || 0}</p>
          <p className="text-sm text-gray-500">Общо часове</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{reportData?.completedAppointments || 0}</p>
          <p className="text-sm text-gray-500">Завършени</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{reportData?.newPatients || 0}</p>
          <p className="text-sm text-gray-500">Нови пациенти</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            {attendanceChange !== 0 && (
              <span className={`text-xs font-medium flex items-center gap-1 ${
                attendanceChange > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {attendanceChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(attendanceChange).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{reportData?.attendanceRate || 0}%</p>
          <p className="text-sm text-gray-500">Присъствие</p>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Appointments by day */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Часове по ден</h3>
          <div className="space-y-3">
            {reportData?.appointmentsByDay?.map((day) => (
              <div key={day.day} className="flex items-center gap-3">
                <span className="w-12 text-sm text-gray-500">{day.day}</span>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg"
                    style={{
                      width: `${Math.min(100, (day.count / (Math.max(...(reportData?.appointmentsByDay?.map(d => d.count) || [1])) || 1)) * 100)}%`
                    }}
                  />
                </div>
                <span className="w-8 text-sm font-medium text-gray-900">{day.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Appointments by service */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Часове по услуга</h3>
          <div className="space-y-3">
            {reportData?.appointmentsByService?.slice(0, 5).map((service) => (
              <div key={service.service} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-gray-600 truncate">{service.service}</span>
                <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                  {service.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Разбивка по статус</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-700">{reportData?.completedAppointments || 0}</p>
            <p className="text-sm text-green-600">Завършени</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-700">
              {(reportData?.totalAppointments || 0) - (reportData?.completedAppointments || 0) - (reportData?.cancelledAppointments || 0) - (reportData?.noShows || 0)}
            </p>
            <p className="text-sm text-blue-600">Предстоящи</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-700">{reportData?.cancelledAppointments || 0}</p>
            <p className="text-sm text-red-600">Отменени</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl">
            <Users className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-amber-700">{reportData?.noShows || 0}</p>
            <p className="text-sm text-amber-600">Неявяване</p>
          </div>
        </div>
      </div>
    </div>
  )
}
