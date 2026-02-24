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
    // Include patients where is_active is true OR is_active is null (for imported/synced patients)
    const { data: rawPatients, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .or('is_active.eq.true,is_active.is.null')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Patients fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
    }

    // Deduplicate patients by phone number
    // Keep the most complete/recent record for each phone
    const patientsByPhone = new Map<string, typeof rawPatients[0]>()
    for (const patient of rawPatients || []) {
      const phone = patient.phone
      if (!phone) continue

      const existing = patientsByPhone.get(phone)
      if (!existing) {
        patientsByPhone.set(phone, patient)
      } else {
        // Prefer patient with a real name over generic names
        const existingHasName = existing.name && existing.name !== 'WhatsApp пациент' && existing.name !== phone
        const currentHasName = patient.name && patient.name !== 'WhatsApp пациент' && patient.name !== phone

        if (currentHasName && !existingHasName) {
          patientsByPhone.set(phone, patient)
        } else if (currentHasName === existingHasName) {
          // If both have names (or both don't), prefer the most recently updated
          const existingDate = new Date(existing.updated_at || existing.created_at)
          const currentDate = new Date(patient.updated_at || patient.created_at)
          if (currentDate > existingDate) {
            patientsByPhone.set(phone, patient)
          }
        }
      }
    }

    const patients = Array.from(patientsByPhone.values())

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
      const scheduledAppointments = patientAppointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length

      return {
        ...patient,
        first_contact_at: patient.created_at,
        last_contact_at: patient.updated_at || patient.created_at,
        total_appointments: totalAppointments,
        completed_appointments: completedAppointments,
        cancelled_appointments: cancelledAppointments,
        no_show_count: noShowCount,
        scheduled_appointments: scheduledAppointments
      }
    })

    // Sort: patients with scheduled appointments first, then by last contact
    patientsWithStats.sort((a, b) => {
      // First priority: patients with upcoming appointments
      if (a.scheduled_appointments > 0 && b.scheduled_appointments === 0) return -1
      if (a.scheduled_appointments === 0 && b.scheduled_appointments > 0) return 1

      // Second priority: by last contact date
      return new Date(b.last_contact_at).getTime() - new Date(a.last_contact_at).getTime()
    })

    return NextResponse.json({
      patients: patientsWithStats
    })
  } catch (error) {
    console.error('Clinic patients error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
