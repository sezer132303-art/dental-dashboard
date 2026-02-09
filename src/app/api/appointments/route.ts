import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/appointments - List appointments
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const clinicId = searchParams.get('clinicId')
    const doctorId = searchParams.get('doctorId')
    const patientId = searchParams.get('patientId')
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    let query = supabase
      .from('appointments')
      .select(`
        *,
        doctor:doctors (id, name, specialty, color),
        patient:patients (id, name, phone)
      `)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
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

// POST /api/appointments - Create a new appointment
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const {
      clinic_id,
      doctor_id,
      patient_id,
      appointment_date,
      start_time,
      end_time,
      type,
      notes,
      price
    } = body

    if (!clinic_id || !doctor_id || !patient_id || !appointment_date || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Липсват задължителни полета' },
        { status: 400 }
      )
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
        clinic_id,
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

    return NextResponse.json({ appointment }, { status: 201 })
  } catch (error) {
    console.error('Create appointment error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
