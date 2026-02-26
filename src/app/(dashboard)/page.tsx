'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
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
  patientsThisMonth: number
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
  appointmentsThisMonth: number
  appointmentsToday: number
  noShows: number
  doctors: DoctorStats[]
  weekRange?: { start: string; end: string }
  today?: string
  currentMonth?: number
  currentYear?: number
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
          {change !== undefined && change !== 0 && (
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
              <span className="text-gray-600 font-normal">от миналата седмица</span>
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

  // Prepare data for charts - use monthly data
  const doctorChartData = metrics.doctors.map(d => ({
    name: d.name.replace('д-р ', ''),
    appointments: d.patientsThisMonth || d.appointmentsThisMonth || 0
  }))

  const totalDoctorAppointments = doctorChartData.reduce((sum, d) => sum + d.appointments, 0)

  // Bulgarian month names
  const monthNames = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
                      'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']
  const currentMonthName = metrics.currentMonth ? monthNames[metrics.currentMonth - 1] : ''

  // Format date for display
  const formatDateBG = (dateStr: string) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}.${month}.${year}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Табло</h1>
          <p className="text-sm text-gray-500">
            {currentMonthName} {metrics.currentYear}
            {metrics.today && ` | Днес: ${formatDateBG(metrics.today)}`}
          </p>
        </div>
      </div>

      {/* KPI Cards - This Week */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">
          Тази седмица ({metrics.weekRange ? `${formatDateBG(metrics.weekRange.start)} - ${formatDateBG(metrics.weekRange.end)}` : ''})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{metrics.appointmentsThisWeek}</p>
            <p className="text-xs text-gray-600">Часове</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{metrics.appointmentsToday}</p>
            <p className="text-xs text-gray-600">Днес</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-3xl font-bold text-purple-600">{metrics.doctors.reduce((sum, d) => sum + (d.patientsThisWeek || 0), 0)}</p>
            <p className="text-xs text-gray-600">По лекари</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{metrics.noShows}</p>
            <p className="text-xs text-gray-600">Неявявания</p>
          </div>
        </div>
      </div>

      {/* KPI Cards - This Month */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Часове този месец"
          value={metrics.appointmentsThisMonth || 0}
          icon={Calendar}
          iconBg="bg-purple-500"
        />
        <KpiCard
          title="Процент присъствие"
          value={metrics.attendanceRate}
          suffix="%"
          icon={CheckCircle2}
          iconBg="bg-green-500"
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
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctor Appointments Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Часове по лекари ({currentMonthName})
          </h3>
          {doctorChartData.length > 0 && totalDoctorAppointments > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={doctorChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#374151" fontSize={12} />
                <YAxis stroke="#374151" fontSize={12} />
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
            <div className="h-[300px] flex flex-col items-center justify-center text-gray-400">
              <p>Няма записани часове за {currentMonthName}</p>
            </div>
          )}
        </div>

        {/* Doctor Distribution Pie */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Разпределение по лекари ({currentMonthName})
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
              Няма записани часове за {currentMonthName}
            </div>
          )}
        </div>
      </div>

      {/* Doctor Stats Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            Статистика по лекари ({currentMonthName})
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
                    Часове (месец)
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
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {doctor.specialty || 'Общ стоматолог'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                      {doctor.patientsThisMonth || doctor.appointmentsThisMonth || 0}
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
