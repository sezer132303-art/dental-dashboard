'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Stethoscope,
  Users,
  Calendar,
  Phone,
  Mail,
  Loader2,
  Plus
} from 'lucide-react'

interface Doctor {
  id: string
  name: string
  specialty: string | null
  phone: string | null
  email: string | null
  color: string
  patientsThisWeek?: number
  completed?: number
  noShow?: number
  attendanceRate?: number
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        // Fetch doctors and metrics in parallel
        const [doctorsRes, metricsRes] = await Promise.all([
          fetch('/api/doctors'),
          fetch('/api/metrics')
        ])

        const doctorsData = await doctorsRes.json()
        const metricsData = await metricsRes.json()

        if (doctorsData.doctors && metricsData.metrics?.doctors) {
          // Merge doctor data with metrics
          const mergedDoctors = doctorsData.doctors.map((doctor: Doctor) => {
            const stats = metricsData.metrics.doctors.find((d: Doctor) => d.id === doctor.id)
            return {
              ...doctor,
              patientsThisWeek: stats?.patientsThisWeek || 0,
              completed: stats?.completed || 0,
              noShow: stats?.noShow || 0,
              attendanceRate: stats?.attendanceRate || 0
            }
          })
          setDoctors(mergedDoctors)
        } else if (doctorsData.doctors) {
          setDoctors(doctorsData.doctors)
        }
      } catch (err) {
        console.error('Error fetching doctors:', err)
        setError('Грешка при зареждане на лекари')
      } finally {
        setLoading(false)
      }
    }

    fetchDoctors()
  }, [])

  const totalPatientsThisWeek = doctors.reduce((sum, d) => sum + (d.patientsThisWeek || 0), 0)

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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100">
              <Stethoscope className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Общо лекари</p>
              <p className="text-2xl font-bold text-gray-900">{doctors.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-100">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Пациенти тази седмица</p>
              <p className="text-2xl font-bold text-gray-900">{totalPatientsThisWeek}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Активни лекари</p>
              <p className="text-2xl font-bold text-gray-900">{doctors.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Doctors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {doctors.map((doctor) => (
          <div
            key={doctor.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={cn('w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold', doctor.color || 'bg-blue-500')}>
                  {doctor.name.split(' ')[1]?.charAt(0) || doctor.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{doctor.name}</h3>
                  <p className="text-sm text-gray-700">{doctor.specialty || 'Общ стоматолог'}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{doctor.patientsThisWeek || 0}</p>
                  <p className="text-xs text-gray-700">тази седмица</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{doctor.completed || 0}</p>
                  <p className="text-xs text-gray-700">завършени</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{doctor.noShow || 0}</p>
                  <p className="text-xs text-gray-700">неявявания</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                {doctor.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{doctor.phone}</span>
                  </div>
                )}
                {doctor.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span>{doctor.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {doctors.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Няма добавени лекари</p>
        </div>
      )}
    </div>
  )
}
