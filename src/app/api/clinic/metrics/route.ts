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
    const supabase = createServerSupabaseClient()

    // Get all appointments for this clinic
    let appointmentsQuery = supabase
      .from('appointments')
      .select('id, status, client_phone')

    if (clinicId) {
      appointmentsQuery = appointmentsQuery.eq('clinic_id', clinicId)
    }

    const { data: appointments, error: aptError } = await appointmentsQuery

    if (aptError) {
      console.error('Appointments error:', aptError)
    }

    const totalAppointments = appointments?.length || 0
    const completedAppointments = appointments?.filter(a => a.status === 'completed').length || 0
    const cancelledAppointments = appointments?.filter(a => a.status === 'cancelled').length || 0
    const noShows = appointments?.filter(a => a.status === 'no-show').length || 0
    const pendingAppointments = appointments?.filter(a => a.status === 'confirmed').length || 0

    // Calculate attendance rate
    const attended = completedAppointments
    const shouldHaveAttended = completedAppointments + noShows
    const attendanceRate = shouldHaveAttended > 0
      ? Math.round((attended / shouldHaveAttended) * 100)
      : 100

    // Get unique patients
    let patientsQuery = supabase
      .from('clients')
      .select('phone', { count: 'exact' })

    if (clinicId) {
      patientsQuery = patientsQuery.eq('clinic_id', clinicId)
    }

    const { count: totalPatients } = await patientsQuery

    // Get active conversations from n8n_chat_histories
    const { data: conversations } = await supabase
      .from('n8n_chat_histories')
      .select('session_id')

    const uniqueSessions = new Set(conversations?.map(c => c.session_id) || [])
    const activeConversations = uniqueSessions.size

    return NextResponse.json({
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      pendingAppointments,
      noShows,
      totalPatients: totalPatients || 0,
      activeConversations,
      attendanceRate
    })
  } catch (error) {
    console.error('Clinic metrics error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
