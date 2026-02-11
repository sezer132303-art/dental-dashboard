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
    // Note: Authentication disabled for development
    // TODO: Re-enable API key verification for production
    // const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')
    // if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    //   return NextResponse.json({ error: 'API key required' }, { status: 401 })
    // }

    const body = await request.json()
    const { appointments } = body as { appointments: CalendarAppointment[] }

    if (!appointments || !Array.isArray(appointments)) {
      return NextResponse.json({ error: 'appointments array required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    let synced = 0
    let skipped = 0
    let errors = 0

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
          const { data: doctor } = await supabase
            .from('doctors')
            .select('id')
            .eq('clinic_id', apt.clinicId)
            .eq('is_active', true)
            .limit(1)
            .single()

          doctorId = doctor?.id
        }

        if (!doctorId) {
          console.error('No doctor found for clinic:', apt.clinicId)
          errors++
          continue
        }

        // Parse date and time
        const startDate = new Date(apt.startTime)
        const endDate = new Date(apt.endTime)

        const date = startDate.toISOString().split('T')[0]
        const startTime = startDate.toTimeString().slice(0, 5)
        const endTime = endDate.toTimeString().slice(0, 5)

        // Create appointment
        const { error: insertError } = await supabase
          .from('appointments')
          .insert({
            clinic_id: apt.clinicId,
            doctor_id: doctorId,
            patient_id: patientId,
            date,
            start_time: startTime,
            end_time: endTime,
            type: apt.appointmentType,
            status: apt.status,
            source: 'google_calendar',
            google_event_id: apt.googleEventId,
            notes: `Синхронизирано от Google Calendar: ${apt.patientName}`
          })

        if (insertError) {
          console.error('Insert appointment error:', insertError)
          errors++
        } else {
          synced++
        }

      } catch (err) {
        console.error('Sync appointment error:', err)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      errors,
      total: appointments.length
    })

  } catch (error) {
    console.error('Calendar sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
