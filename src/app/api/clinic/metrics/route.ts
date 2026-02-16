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

    // Get current week boundaries
    const now = new Date()
    const dayOfWeek = now.getDay()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const startDateStr = startOfWeek.toISOString().split('T')[0]
    const endDateStr = endOfWeek.toISOString().split('T')[0]

    // Get all appointments for this clinic
    const { data: appointments, error: aptError } = await supabase
      .from('appointments')
      .select('id, status, doctor_id, appointment_date')
      .eq('clinic_id', clinicId)

    if (aptError) {
      console.error('Appointments error:', aptError)
    }

    const totalAppointments = appointments?.length || 0
    const completedAppointments = appointments?.filter(a => a.status === 'completed').length || 0
    const cancelledAppointments = appointments?.filter(a => a.status === 'cancelled').length || 0
    const noShows = appointments?.filter(a => a.status === 'no_show').length || 0
    const scheduledAppointments = appointments?.filter(a => a.status === 'scheduled').length || 0
    const confirmedAppointments = appointments?.filter(a => a.status === 'confirmed').length || 0

    // Calculate attendance rate
    const attended = completedAppointments
    const shouldHaveAttended = completedAppointments + noShows
    const attendanceRate = shouldHaveAttended > 0
      ? Math.round((attended / shouldHaveAttended) * 100)
      : 100

    // Get total patients
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

    // Get doctors with their weekly stats
    const { data: doctors } = await supabase
      .from('doctors')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    // Filter appointments for this week
    const thisWeekAppointments = appointments?.filter(a =>
      a.appointment_date >= startDateStr && a.appointment_date <= endDateStr
    ) || []

    const appointmentsThisWeek = thisWeekAppointments.length
    const appointmentsThisWeekNoShow = thisWeekAppointments.filter(a => a.status === 'no_show').length

    // Today's appointments
    const todayStr = new Date().toISOString().split('T')[0]
    const appointmentsToday = appointments?.filter(a => a.appointment_date === todayStr).length || 0

    // Calculate per-doctor stats for this week
    const doctorStats = doctors?.map(doctor => {
      const doctorAppointments = appointments?.filter(a => a.doctor_id === doctor.id) || []
      const weekAppointments = doctorAppointments.filter(a =>
        a.appointment_date >= startDateStr && a.appointment_date <= endDateStr
      )

      return {
        id: doctor.id,
        name: doctor.name,
        patientsThisWeek: weekAppointments.length,
        completed: weekAppointments.filter(a => a.status === 'completed').length,
        noShow: weekAppointments.filter(a => a.status === 'no_show').length,
        attendanceRate: (() => {
          const weekCompleted = weekAppointments.filter(a => a.status === 'completed').length
          const weekNoShow = weekAppointments.filter(a => a.status === 'no_show').length
          const total = weekCompleted + weekNoShow
          return total > 0 ? Math.round((weekCompleted / total) * 100) : 100
        })()
      }
    }) || []

    // Get active conversations count (if table exists)
    let activeConversations = 0
    try {
      const { count } = await supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', 'active')
      activeConversations = count || 0
    } catch {
      // Table may not exist, ignore
    }

    return NextResponse.json({
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      scheduledAppointments,
      confirmedAppointments,
      pendingAppointments: scheduledAppointments + confirmedAppointments,
      noShows,
      totalPatients: totalPatients || 0,
      activeConversations,
      attendanceRate,
      appointmentsThisWeek,
      appointmentsToday,
      doctors: doctorStats
    })
  } catch (error) {
    console.error('Clinic metrics error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
