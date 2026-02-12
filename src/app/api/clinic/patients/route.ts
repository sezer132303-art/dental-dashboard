import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

export async function GET() {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()

    // Get patients from the patients table
    const { data: patients, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Patients fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
    }

    // Get appointment stats for each patient
    const { data: appointments } = await supabase
      .from('appointments')
      .select('patient_id, status')
      .eq('clinic_id', clinicId)

    // Calculate stats per patient
    const patientsWithStats = (patients || []).map(patient => {
      const patientAppointments = appointments?.filter(a => a.patient_id === patient.id) || []
      const totalAppointments = patientAppointments.length
      const completedAppointments = patientAppointments.filter(a => a.status === 'completed').length
      const cancelledAppointments = patientAppointments.filter(a => a.status === 'cancelled').length
      const noShowCount = patientAppointments.filter(a => a.status === 'no_show').length

      return {
        ...patient,
        first_contact_at: patient.created_at,
        last_contact_at: patient.updated_at || patient.created_at,
        total_appointments: totalAppointments,
        completed_appointments: completedAppointments,
        cancelled_appointments: cancelledAppointments,
        no_show_count: noShowCount
      }
    })

    return NextResponse.json({
      patients: patientsWithStats
    })
  } catch (error) {
    console.error('Clinic patients error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
