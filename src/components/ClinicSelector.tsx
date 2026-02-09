'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, ChevronDown, Check } from 'lucide-react'

interface Clinic {
  id: string
  name: string
}

interface ClinicSelectorProps {
  selectedClinicId: string | null
  onClinicChange: (clinicId: string | null) => void
  showAllOption?: boolean
}

export function ClinicSelector({ selectedClinicId, onClinicChange, showAllOption = true }: ClinicSelectorProps) {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchClinics()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchClinics() {
    try {
      const response = await fetch('/api/clinics')
      if (response.ok) {
        const data = await response.json()
        setClinics(data)
      }
    } catch (error) {
      console.error('Failed to fetch clinics:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedClinic = clinics.find(c => c.id === selectedClinicId)
  const displayName = selectedClinic ? selectedClinic.name : 'Всички клиники'

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg animate-pulse">
        <div className="w-5 h-5 bg-gray-300 rounded"></div>
        <div className="w-24 h-4 bg-gray-300 rounded"></div>
      </div>
    )
  }

  if (clinics.length <= 1 && !showAllOption) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
      >
        <Building2 className="w-5 h-5 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 max-w-[150px] truncate">
          {displayName}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {showAllOption && (
              <button
                onClick={() => {
                  onClinicChange(null)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 ${
                  !selectedClinicId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span>Всички клиники</span>
                {!selectedClinicId && <Check className="w-4 h-4" />}
              </button>
            )}
            {clinics.map((clinic) => (
              <button
                key={clinic.id}
                onClick={() => {
                  onClinicChange(clinic.id)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 ${
                  selectedClinicId === clinic.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span className="truncate">{clinic.name}</span>
                {selectedClinicId === clinic.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
