import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey, getDefaultClinicId } from '@/lib/api-auth'

// GET /api/n8n/availability?date=2026-02-10&doctorId=xxx&clinicId=xxx
export async function GET(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const doctorId = searchParams.get('doctorId')
    const date = searchParams.get('date') // YYYY-MM-DD
    const clinicId = searchParams.get('clinicId') || getDefaultClinicId()

    if (!date) {
      return NextResponse.json(
        { error: 'Missing required parameter: date' },
        { status: 400 }
      )
    }

    // Get doctors (optionally filtered by doctorId)
    let doctorsQuery = supabase
      .from('doctors')
      .select('id, name, specialty, working_hours, color, google_calendar_id, clinic_id')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    if (doctorId) {
      doctorsQuery = doctorsQuery.eq('id', doctorId)
    }

    const { data: doctors, error: doctorsError } = await doctorsQuery

    if (doctorsError || !doctors?.length) {
      return NextResponse.json({
        available: false,
        message: 'Няма налични лекари',
        slots: [],
        doctors: []
      })
    }

    // Get existing appointments for the date
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('doctor_id, start_time, end_time')
      .eq('appointment_date', date)
      .eq('clinic_id', clinicId)
      .neq('status', 'cancelled')

    if (apptError) {
      throw apptError
    }

    // Calculate available slots for each doctor
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const dateObj = new Date(date)
    const dayOfWeek = dayNames[dateObj.getDay()]

    const availableSlots: Array<{
      doctorId: string
      doctorName: string
      specialty: string | null
      color: string
      date: string
      startTime: string
      endTime: string
    }> = []

    for (const doctor of doctors) {
      const workingHours = doctor.working_hours?.[dayOfWeek]
      if (!workingHours || !workingHours.start || !workingHours.end) continue

      const doctorAppointments = appointments?.filter(a => a.doctor_id === doctor.id) || []

      // Generate 30-minute slots
      const startHour = parseInt(workingHours.start.split(':')[0])
      const startMinute = parseInt(workingHours.start.split(':')[1] || '0')
      const endHour = parseInt(workingHours.end.split(':')[0])

      for (let hour = startHour; hour < endHour; hour++) {
        for (const minutes of [0, 30]) {
          // Skip first iteration if starting after 00
          if (hour === startHour && minutes < startMinute) continue

          const slotStart = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
          const slotEndMinutes = minutes + 30
          const slotEndHour = slotEndMinutes >= 60 ? hour + 1 : hour
          const slotEnd = `${slotEndHour.toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`

          // Check if slot is available (no overlapping appointments)
          const isBooked = doctorAppointments.some(apt => {
            const aptStart = apt.start_time.substring(0, 5)
            const aptEnd = apt.end_time.substring(0, 5)
            return slotStart < aptEnd && slotEnd > aptStart
          })

          if (!isBooked) {
            availableSlots.push({
              doctorId: doctor.id,
              doctorName: doctor.name,
              specialty: doctor.specialty,
              color: doctor.color,
              date,
              startTime: slotStart,
              endTime: slotEnd
            })
          }
        }
      }
    }

    return NextResponse.json({
      available: availableSlots.length > 0,
      slotsCount: availableSlots.length,
      slots: availableSlots.slice(0, 20), // Return first 20 slots
      doctors: doctors.map(d => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        color: d.color,
        calendar_id: d.google_calendar_id,
        clinic_id: d.clinic_id
      }))
    })

  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}
