'use client'

import { useEffect, useState } from 'react'
import { Users, Search, Phone, Calendar, CheckCircle, XCircle } from 'lucide-react'

interface Patient {
  id: string
  phone: string
  name: string
  email?: string
  first_contact_at: string
  last_contact_at: string
  total_appointments: number
  completed_appointments: number
  cancelled_appointments: number
  no_show_count: number
}

export default function ClinicPatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchPatients()
  }, [])

  async function fetchPatients() {
    try {
      const response = await fetch('/api/clinic/patients')
      if (response.ok) {
        const data = await response.json()
        setPatients(data.patients || [])
      }
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPatients = patients.filter(patient =>
    patient.name?.toLowerCase().includes(search.toLowerCase()) ||
    patient.phone?.includes(search)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Пациенти</h1>
        <p className="text-gray-500">Списък с всички пациенти на клиниката</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Търсене по име или телефон..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
          />
        </div>
      </div>

      {/* Patients grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Няма намерени пациенти</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-semibold text-teal-700">
                    {(patient.name || patient.phone).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {patient.name || 'Неизвестен'}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <Phone className="w-3 h-3" />
                    <span>{patient.phone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-blue-600">
                    <Calendar className="w-4 h-4" />
                    <span className="font-semibold">{patient.total_appointments}</span>
                  </div>
                  <p className="text-xs text-gray-500">Часове</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-semibold">{patient.completed_appointments}</span>
                  </div>
                  <p className="text-xs text-gray-500">Завършени</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span className="font-semibold">{patient.no_show_count}</span>
                  </div>
                  <p className="text-xs text-gray-500">Неявяване</p>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-400">
                Последен контакт: {new Date(patient.last_contact_at).toLocaleDateString('bg-BG')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
