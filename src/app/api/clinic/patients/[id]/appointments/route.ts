import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

// GET /api/clinic/patients/[id]/appointments - Get patient's appointment history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const { id: patientId } = await params
    const supabase = createServerSupabaseClient()

    // Verify the patient belongs to this clinic
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('clinic_id', clinicId)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Get appointments with doctor info
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        status,
        type,
        notes,
        doctor:doctors (id, name)
      `)
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)
      .order('appointment_date', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Fetch appointments error:', error)
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
    }

    // Format response
    const formattedAppointments = appointments.map(apt => ({
      id: apt.id,
      appointment_date: apt.appointment_date,
      start_time: apt.start_time,
      end_time: apt.end_time,
      status: apt.status,
      type: apt.type,
      notes: apt.notes,
      doctor_name: (apt.doctor as { name: string } | null)?.name || null
    }))

    return NextResponse.json({ appointments: formattedAppointments })
  } catch (error) {
    console.error('Get patient appointments error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
