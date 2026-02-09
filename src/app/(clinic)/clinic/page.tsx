'use client'

import { useEffect, useState } from 'react'
import { Calendar, Users, MessageCircle, TrendingUp, Clock, CheckCircle } from 'lucide-react'

interface ClinicMetrics {
  totalAppointments: number
  completedAppointments: number
  pendingAppointments: number
  totalPatients: number
  activeConversations: number
  attendanceRate: number
}

export default function ClinicDashboard() {
  const [metrics, setMetrics] = useState<ClinicMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentAppointments, setRecentAppointments] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch clinic-specific metrics
        const [metricsRes, appointmentsRes] = await Promise.all([
          fetch('/api/clinic/metrics'),
          fetch('/api/clinic/appointments?limit=5')
        ])

        if (metricsRes.ok) {
          const data = await metricsRes.json()
          setMetrics(data)
        }

        if (appointmentsRes.ok) {
          const data = await appointmentsRes.json()
          setRecentAppointments(data.appointments || [])
        }
      } catch (error) {
        console.error('Error fetching clinic data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  const stats = [
    {
      name: 'Общо часове',
      value: metrics?.totalAppointments || 0,
      icon: Calendar,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Завършени',
      value: metrics?.completedAppointments || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50'
    },
    {
      name: 'Предстоящи',
      value: metrics?.pendingAppointments || 0,
      icon: Clock,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50'
    },
    {
      name: 'Пациенти',
      value: metrics?.totalPatients || 0,
      icon: Users,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50'
    },
    {
      name: 'Активни чатове',
      value: metrics?.activeConversations || 0,
      icon: MessageCircle,
      color: 'bg-teal-500',
      bgColor: 'bg-teal-50'
    },
    {
      name: 'Присъствие',
      value: `${metrics?.attendanceRate || 0}%`,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Добре дошли в клиника портала</h2>
        <p className="text-teal-100">
          Преглеждайте вашите часове, пациенти и WhatsApp разговори на едно място.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color.replace('bg-', 'text-')}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.name}</p>
          </div>
        ))}
      </div>

      {/* Recent appointments */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Последни часове</h3>
        </div>
        <div className="divide-y">
          {recentAppointments.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Няма скорошни часове
            </div>
          ) : (
            recentAppointments.map((apt) => (
              <div key={apt.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-teal-700">
                      {(apt.client_name || 'П').charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{apt.client_name || 'Пациент'}</p>
                    <p className="text-sm text-gray-500">{apt.service}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(apt.appointment_datetime).toLocaleDateString('bg-BG')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(apt.appointment_datetime).toLocaleTimeString('bg-BG', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  apt.status === 'completed' ? 'bg-green-100 text-green-700' :
                  apt.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                  apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {apt.status === 'completed' ? 'Завършен' :
                   apt.status === 'confirmed' ? 'Потвърден' :
                   apt.status === 'cancelled' ? 'Отменен' : apt.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
