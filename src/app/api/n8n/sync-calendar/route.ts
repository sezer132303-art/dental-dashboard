import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

interface CalendarAppointment {
  googleEventId: string
  clinicId: string
  doctorId?: string
  patientName: string
  patientPhone?: string
  appointmentType: string
  startTime: string
  endTime: string
  status: 'scheduled' | 'cancelled'
  source: string
}

// POST /api/n8n/sync-calendar - Sync calendar events to appointments
export async function POST(request: NextRequest) {
  try {
    // API Key authentication for n8n webhooks
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
      console.error('Calendar sync: Invalid or missing API key')
      return NextResponse.json({ error: 'API key required' }, { status: 401 })
    }

    const body = await request.json()
    const { appointments } = body as { appointments: CalendarAppointment[] }

    if (!appointments || !Array.isArray(appointments)) {
      return NextResponse.json({ error: 'appointments array required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    let synced = 0
    let skipped = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const apt of appointments) {
      try {
        // Check if event already synced by google_event_id
        const { data: existing } = await supabase
          .from('appointments')
          .select('id, status')
          .eq('google_event_id', apt.googleEventId)
          .maybeSingle()

        if (existing) {
          // Update if status changed
          if (existing.status !== apt.status) {
            await supabase
              .from('appointments')
              .update({ status: apt.status })
              .eq('id', existing.id)
            synced++
          } else {
            skipped++
          }
          continue
        }

        // Find or create patient
        let patientId = null
        if (apt.patientPhone) {
          // Normalize phone
          let phone = apt.patientPhone.replace(/[\s\-\+]/g, '')
          if (phone.startsWith('0')) {
            phone = '359' + phone.slice(1)
          } else if (!phone.startsWith('359')) {
            phone = '359' + phone
          }

          // Check if patient exists
          const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('phone', phone)
            .eq('clinic_id', apt.clinicId)
            .maybeSingle()

          if (patient) {
            patientId = patient.id
          } else {
            // Create new patient
            const { data: newPatient } = await supabase
              .from('patients')
              .insert({
                clinic_id: apt.clinicId,
                name: apt.patientName,
                phone: phone
              })
              .select('id')
              .single()

            if (newPatient) {
              patientId = newPatient.id
            }
          }
        }

        // Get first doctor if not specified
        let doctorId = apt.doctorId
        if (!doctorId) {
          const { data: doctor, error: doctorError } = await supabase
            .from('doctors')
            .select('id')
            .eq('clinic_id', apt.clinicId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()

          if (doctorError) {
            console.error('Doctor query error:', doctorError)
          }
          doctorId = doctor?.id
        }

        if (!doctorId) {
          const msg = `No doctor found for clinic: ${apt.clinicId}`
          console.error(msg)
          errorDetails.push(msg)
          errors++
          continue
        }

        // Parse date and time - use consistent timezone handling
        const startDate = new Date(apt.startTime)
        const endDate = new Date(apt.endTime)

        // Format date in local timezone (not UTC) to avoid day shifts
        const formatLocalDate = (date: Date) => {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const formatLocalTime = (date: Date) => {
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          return `${hours}:${minutes}`
        }

        const appointmentDate = formatLocalDate(startDate)
        const startTime = formatLocalTime(startDate)
        const endTime = formatLocalTime(endDate)

        // Debug logging
        console.log('Sync appointment:', {
          originalStartTime: apt.startTime,
          parsedDate: startDate.toString(),
          appointmentDate,
          startTime,
          endTime
        })

        // Create or update appointment (upsert to prevent duplicates)
        const { error: insertError } = await supabase
          .from('appointments')
          .upsert({
            clinic_id: apt.clinicId,
            doctor_id: doctorId,
            patient_id: patientId,
            appointment_date: appointmentDate,
            start_time: startTime,
            end_time: endTime,
            type: apt.appointmentType,
            status: apt.status,
            source: 'google_calendar',
            google_event_id: apt.googleEventId,
            notes: `Синхронизирано от Google Calendar: ${apt.patientName}`
          }, {
            onConflict: 'clinic_id,google_event_id',
            ignoreDuplicates: false
          })

        if (insertError) {
          const msg = `Insert error: ${insertError.message}`
          console.error('Insert appointment error:', insertError)
          errorDetails.push(msg)
          errors++
        } else {
          synced++
        }

      } catch (err) {
        const msg = `Sync error: ${err instanceof Error ? err.message : String(err)}`
        console.error('Sync appointment error:', err)
        errorDetails.push(msg)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      errors,
      errorDetails: errorDetails.slice(0, 10),
      total: appointments.length
    })

  } catch (error) {
    console.error('Calendar sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
