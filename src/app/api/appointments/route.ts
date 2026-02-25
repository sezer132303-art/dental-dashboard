import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// GET /api/appointments - List appointments (requires authentication)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const requestedClinicId = searchParams.get('clinicId')
    const doctorId = searchParams.get('doctorId')
    const patientId = searchParams.get('patientId')
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    // Get authorized clinic(s) based on user session
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('appointments')
      .select(`
        *,
        doctor:doctors (id, name, specialty, color),
        patient:patients (id, name, phone)
      `)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })

    // Non-admin users MUST have a clinic_id filter
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    } else if (!isAdmin) {
      return NextResponse.json({ error: 'Clinic access required' }, { status: 403 })
    }

    if (doctorId) {
      query = query.eq('doctor_id', doctorId)
    }

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    if (date) {
      query = query.eq('appointment_date', date)
    }

    if (startDate) {
      query = query.gte('appointment_date', startDate)
    }

    if (endDate) {
      query = query.lte('appointment_date', endDate)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: appointments, error } = await query

    if (error) {
      console.error('Error fetching appointments:', error)
      return NextResponse.json({ error: 'Грешка при зареждане на часове' }, { status: 500 })
    }

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error('Appointments API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// POST /api/appointments - Create a new appointment (requires authentication)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      clinic_id: requestedClinicId,
      doctor_id,
      patient_id,
      appointment_date,
      start_time,
      end_time,
      type,
      notes,
      price
    } = body

    // Verify user is authorized and get their clinic
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const effectiveClinicId = isAdmin ? (requestedClinicId || clinicId) : clinicId

    if (!effectiveClinicId || !doctor_id || !patient_id || !appointment_date || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Липсват задължителни полета' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Verify doctor belongs to this clinic
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('id', doctor_id)
      .eq('clinic_id', effectiveClinicId)
      .single()

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found in this clinic' }, { status: 403 })
    }

    // Verify patient belongs to this clinic
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patient_id)
      .eq('clinic_id', effectiveClinicId)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found in this clinic' }, { status: 403 })
    }

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', doctor_id)
      .eq('appointment_date', appointment_date)
      .neq('status', 'cancelled')
      .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: 'Има препокриване с друг час' },
        { status: 409 }
      )
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        clinic_id: effectiveClinicId,
        doctor_id,
        patient_id,
        appointment_date,
        start_time,
        end_time,
        type,
        notes,
        price,
        status: 'scheduled'
      })
      .select(`
        *,
        doctor:doctors (id, name, specialty, color),
        patient:patients (id, name, phone)
      `)
      .single()

    if (error) {
      console.error('Error creating appointment:', error)
      return NextResponse.json({ error: 'Грешка при създаване на час' }, { status: 500 })
    }

    // Automatically create reminders for the appointment
    if (appointment) {
      const appointmentDateTime = new Date(`${appointment_date}T${start_time}`)
      const now = new Date()

      // Create reminder records (24h and 3h before)
      const reminders = []

      // 24h reminder - scheduled for 24 hours before
      const reminder24h = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000)
      if (reminder24h > now) {
        reminders.push({
          appointment_id: appointment.id,
          type: '24h',
          status: 'pending',
          scheduled_for: reminder24h.toISOString()
        })
      }

      // 3h reminder - scheduled for 3 hours before
      const reminder3h = new Date(appointmentDateTime.getTime() - 3 * 60 * 60 * 1000)
      if (reminder3h > now) {
        reminders.push({
          appointment_id: appointment.id,
          type: '3h',
          status: 'pending',
          scheduled_for: reminder3h.toISOString()
        })
      }

      if (reminders.length > 0) {
        const { error: reminderError } = await supabase
          .from('reminders')
          .insert(reminders)

        if (reminderError) {
          console.error('Error creating reminders:', reminderError)
          // Don't fail the appointment creation, just log the error
        }
      }
    }

    return NextResponse.json({ appointment }, { status: 201 })
  } catch (error) {
    console.error('Create appointment error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
