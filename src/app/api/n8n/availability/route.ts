import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey, getDefaultClinicId } from '@/lib/api-auth'

// Helper to convert time string to minutes
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Helper to convert minutes to time string
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// GET /api/n8n/availability?date=2026-02-10&doctorId=xxx&clinicId=xxx&type=преглед&startTime=14:00
// Returns available time slots considering service duration
export async function GET(request: NextRequest) {
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
    const serviceType = searchParams.get('type') || searchParams.get('serviceType')
    const requestedTime = searchParams.get('startTime') // Optional: check specific time

    if (!date) {
      return NextResponse.json(
        { error: 'Missing required parameter: date' },
        { status: 400 }
      )
    }

    // Get service duration from appointment_types
    let serviceDuration = 30 // Default 30 minutes
    if (serviceType) {
      const { data: appointmentType } = await supabase
        .from('appointment_types')
        .select('duration_minutes, name')
        .eq('clinic_id', clinicId)
        .ilike('name', `%${serviceType}%`)
        .single()

      if (appointmentType?.duration_minutes) {
        serviceDuration = appointmentType.duration_minutes
      }
    }

    // Get doctors
    let doctorsQuery = supabase
      .from('doctors')
      .select('id, name, specialty, color, calendar_id, clinic_id, working_hours')
      .eq('is_active', true)

    if (clinicId) {
      doctorsQuery = doctorsQuery.eq('clinic_id', clinicId)
    }

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
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('id, doctor_id, start_time, end_time')
      .eq('appointment_date', date)
      .eq('clinic_id', clinicId)
      .neq('status', 'cancelled')
      .in('doctor_id', doctors.map(d => d.id))

    // Check if specific time is available
    if (requestedTime) {
      const requestedStartMinutes = timeToMinutes(requestedTime)
      const requestedEndMinutes = requestedStartMinutes + serviceDuration

      // Find available doctor for this time
      for (const doctor of doctors) {
        // Check doctor's working hours
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
        const workingHours = doctor.working_hours?.[dayOfWeek]

        if (!workingHours) continue // Doctor not working this day

        const workStart = timeToMinutes(workingHours.start)
        const workEnd = timeToMinutes(workingHours.end)

        // Check if requested time is within working hours
        if (requestedStartMinutes < workStart || requestedEndMinutes > workEnd) {
          continue
        }

        // Check for conflicts with existing appointments
        const doctorAppointments = existingAppointments?.filter(a => a.doctor_id === doctor.id) || []

        let hasConflict = false
        for (const apt of doctorAppointments) {
          const aptStart = timeToMinutes(apt.start_time)
          const aptEnd = timeToMinutes(apt.end_time)

          // Overlap check: new_start < existing_end AND new_end > existing_start
          if (requestedStartMinutes < aptEnd && requestedEndMinutes > aptStart) {
            hasConflict = true
            break
          }
        }

        if (!hasConflict) {
          return NextResponse.json({
            available: true,
            requestedTime,
            serviceDuration,
            endTime: minutesToTime(requestedEndMinutes),
            doctor: {
              id: doctor.id,
              name: doctor.name,
              specialty: doctor.specialty
            },
            message: `Часът ${requestedTime} е свободен при д-р ${doctor.name}`
          })
        }
      }

      // No available doctor for this time
      return NextResponse.json({
        available: false,
        requestedTime,
        serviceDuration,
        message: `Часът ${requestedTime} не е свободен. Услугата изисква ${serviceDuration} минути.`,
        suggestedSlots: await findAlternativeSlots(doctors, existingAppointments || [], date, serviceDuration, 3)
      })
    }

    // Return all available slots for the day
    const availableSlots = []

    for (const doctor of doctors) {
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
      const workingHours = doctor.working_hours?.[dayOfWeek]

      if (!workingHours) continue

      const workStart = timeToMinutes(workingHours.start)
      const workEnd = timeToMinutes(workingHours.end)
      const doctorAppointments = existingAppointments?.filter(a => a.doctor_id === doctor.id) || []

      // Generate slots every 30 minutes
      for (let slotStart = workStart; slotStart + serviceDuration <= workEnd; slotStart += 30) {
        const slotEnd = slotStart + serviceDuration

        // Check for conflicts
        let hasConflict = false
        for (const apt of doctorAppointments) {
          const aptStart = timeToMinutes(apt.start_time)
          const aptEnd = timeToMinutes(apt.end_time)

          if (slotStart < aptEnd && slotEnd > aptStart) {
            hasConflict = true
            break
          }
        }

        if (!hasConflict) {
          availableSlots.push({
            startTime: minutesToTime(slotStart),
            endTime: minutesToTime(slotEnd),
            doctorId: doctor.id,
            doctorName: doctor.name
          })
        }
      }
    }

    return NextResponse.json({
      version: 'v3-duration-aware',
      available: availableSlots.length > 0,
      serviceDuration,
      serviceType: serviceType || 'Преглед',
      slotsCount: availableSlots.length,
      slots: availableSlots.slice(0, 20), // Limit to first 20 slots
      doctors: doctors.map(d => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        color: d.color,
        calendar_id: d.calendar_id,
        clinic_id: d.clinic_id
      }))
    })

  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}

// Helper function to find alternative available slots
async function findAlternativeSlots(
  doctors: any[],
  existingAppointments: any[],
  date: string,
  serviceDuration: number,
  count: number
): Promise<Array<{ startTime: string; endTime: string; doctorId: string; doctorName: string }>> {
  const slots = []

  for (const doctor of doctors) {
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
    const workingHours = doctor.working_hours?.[dayOfWeek]

    if (!workingHours) continue

    const workStart = timeToMinutes(workingHours.start)
    const workEnd = timeToMinutes(workingHours.end)
    const doctorAppointments = existingAppointments.filter(a => a.doctor_id === doctor.id)

    for (let slotStart = workStart; slotStart + serviceDuration <= workEnd && slots.length < count; slotStart += 30) {
      const slotEnd = slotStart + serviceDuration

      let hasConflict = false
      for (const apt of doctorAppointments) {
        const aptStart = timeToMinutes(apt.start_time)
        const aptEnd = timeToMinutes(apt.end_time)

        if (slotStart < aptEnd && slotEnd > aptStart) {
          hasConflict = true
          break
        }
      }

      if (!hasConflict) {
        slots.push({
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd),
          doctorId: doctor.id,
          doctorName: doctor.name
        })
      }
    }

    if (slots.length >= count) break
  }

  return slots
}
