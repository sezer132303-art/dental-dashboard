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

    // Get current week boundaries (Monday to Sunday) in Bulgaria timezone
    // Use Europe/Sofia timezone for Bulgaria
    const bulgariaFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Sofia',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })

    const now = new Date()
    const todayInBulgaria = bulgariaFormatter.format(now) // YYYY-MM-DD format

    // Parse the Bulgaria date to get day of week
    const [year, month, day] = todayInBulgaria.split('-').map(Number)
    const bulgariaDate = new Date(year, month - 1, day)
    const dayOfWeek = bulgariaDate.getDay() // 0 = Sunday, 1 = Monday, etc.

    // Calculate days to subtract to get to Monday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    // Calculate start and end of week
    const startOfWeek = new Date(year, month - 1, day - daysToMonday)
    const endOfWeek = new Date(year, month - 1, day - daysToMonday + 6)

    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    const startDateStr = formatDate(startOfWeek)
    const endDateStr = formatDate(endOfWeek)
    const todayStr = todayInBulgaria

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

    // Debug: log all appointment dates to help diagnose
    console.log('Week range:', startDateStr, 'to', endDateStr)
    console.log('All appointments dates:', appointments?.map(a => a.appointment_date).slice(0, 10))
    console.log('This week appointments:', thisWeekAppointments.length)
    const appointmentsThisWeekNoShow = thisWeekAppointments.filter(a => a.status === 'no_show').length

    // Today's appointments (todayStr already defined above using Bulgaria timezone)
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

    // Weekly no-shows
    const noShowsThisWeek = thisWeekAppointments.filter(a => a.status === 'no_show').length

    return NextResponse.json({
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      scheduledAppointments,
      confirmedAppointments,
      pendingAppointments: scheduledAppointments + confirmedAppointments,
      noShows: noShowsThisWeek, // Changed to weekly no-shows for dashboard
      noShowsTotal: noShows, // Keep total for other uses
      totalPatients: totalPatients || 0,
      activeConversations,
      attendanceRate,
      appointmentsThisWeek,
      appointmentsToday,
      doctors: doctorStats,
      // Debug info
      weekRange: { start: startDateStr, end: endDateStr },
      today: todayStr,
      serverTime: new Date().toISOString()
    })
  } catch (error) {
    console.error('Clinic metrics error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
