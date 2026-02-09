'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Stethoscope
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface DoctorStats {
  id: string
  name: string
  specialty: string | null
  color: string
  patientsThisWeek: number
  completed: number
  noShow: number
  attendanceRate: number
}

interface Metrics {
  attendanceRate: number
  attendanceChange: number
  totalPatients: number
  appointmentsThisWeek: number
  appointmentsToday: number
  noShows: number
  doctors: DoctorStats[]
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']

interface KpiCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  iconBg: string
  suffix?: string
}

function KpiCard({ title, value, change, icon: Icon, iconBg, suffix }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {value}{suffix}
          </p>
          {change !== undefined && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-sm font-medium',
              change >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {change >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{Math.abs(change)}%</span>
              <span className="text-gray-400 font-normal">от миналата седмица</span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconBg)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics')
        const data = await response.json()

        if (data.metrics) {
          setMetrics(data.metrics)
        }
      } catch (err) {
        console.error('Error fetching metrics:', err)
        setError('Грешка при зареждане на метрики')
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error || 'Грешка при зареждане на данни'}
      </div>
    )
  }

  // Prepare data for charts
  const doctorChartData = metrics.doctors.map(d => ({
    name: d.name.replace('д-р ', ''),
    appointments: d.patientsThisWeek
  }))

  const totalDoctorAppointments = metrics.doctors.reduce((sum, d) => sum + d.patientsThisWeek, 0)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Процент присъствие"
          value={metrics.attendanceRate}
          suffix="%"
          change={metrics.attendanceChange}
          icon={CheckCircle2}
          iconBg="bg-green-500"
        />
        <KpiCard
          title="Часове днес"
          value={metrics.appointmentsToday}
          icon={Clock}
          iconBg="bg-blue-500"
        />
        <KpiCard
          title="Часове тази седмица"
          value={metrics.appointmentsThisWeek}
          icon={Calendar}
          iconBg="bg-purple-500"
        />
        <KpiCard
          title="Общо пациенти"
          value={metrics.totalPatients}
          icon={Users}
          iconBg="bg-indigo-500"
        />
        <KpiCard
          title="Активни лекари"
          value={metrics.doctors.length}
          icon={Stethoscope}
          iconBg="bg-cyan-500"
        />
        <KpiCard
          title="Неявявания (седмица)"
          value={metrics.noShows}
          icon={AlertTriangle}
          iconBg="bg-red-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctor Appointments Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Часове по лекари (тази седмица)
          </h3>
          {doctorChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={doctorChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar
                  dataKey="appointments"
                  fill="#8B5CF6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Няма данни
            </div>
          )}
        </div>

        {/* Doctor Distribution Pie */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Разпределение по лекари
          </h3>
          {doctorChartData.length > 0 && totalDoctorAppointments > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={doctorChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="appointments"
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {doctorChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Няма данни
            </div>
          )}
        </div>
      </div>

      {/* Doctor Stats Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            Статистика по лекари (тази седмица)
          </h3>
        </div>
        {metrics.doctors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Лекар
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Специалност
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Общо часове
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Завършени
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Неявявания
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    % Присъствие
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.doctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm',
                            doctor.color || 'bg-blue-500'
                          )}
                        >
                          {doctor.name.split(' ')[1]?.charAt(0) || doctor.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{doctor.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {doctor.specialty || 'Общ стоматолог'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {doctor.patientsThisWeek}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">
                      {doctor.completed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-red-600 font-medium">
                      {doctor.noShow}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        'font-semibold',
                        doctor.attendanceRate >= 90 ? 'text-green-600' :
                        doctor.attendanceRate >= 75 ? 'text-yellow-600' :
                        'text-red-600'
                      )}>
                        {doctor.attendanceRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            Няма добавени лекари
          </div>
        )}
      </div>
    </div>
  )
}
