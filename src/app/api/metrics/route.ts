import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// GET /api/metrics - Get dashboard metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedClinicId = searchParams.get('clinicId')

    // Check authentication
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    // Non-admin users MUST have a clinic_id
    if (!isAdmin && !clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()

    // Get current date info
    const today = new Date()
    const startOfWeek = new Date(today)
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    startOfWeek.setDate(today.getDate() + mondayOffset) // Monday
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday

    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)
    const endOfLastWeek = new Date(startOfWeek)
    endOfLastWeek.setDate(endOfLastWeek.getDate() - 1)

    // Month dates (1st to last day of current month)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    // Format dates
    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    // Get this week's appointments
    let thisWeekQuery = supabase
      .from('appointments')
      .select('id, status')
      .gte('appointment_date', formatDate(startOfWeek))
      .lte('appointment_date', formatDate(endOfWeek))

    if (clinicId) {
      thisWeekQuery = thisWeekQuery.eq('clinic_id', clinicId)
    }

    const { data: thisWeekAppointments } = await thisWeekQuery

    // Get last week's appointments
    let lastWeekQuery = supabase
      .from('appointments')
      .select('id, status')
      .gte('appointment_date', formatDate(startOfLastWeek))
      .lte('appointment_date', formatDate(endOfLastWeek))

    if (clinicId) {
      lastWeekQuery = lastWeekQuery.eq('clinic_id', clinicId)
    }

    const { data: lastWeekAppointments } = await lastWeekQuery

    // Calculate attendance rates
    const thisWeekTotal = thisWeekAppointments?.length || 0
    const thisWeekCompleted = thisWeekAppointments?.filter(a => a.status === 'completed').length || 0
    const thisWeekNoShow = thisWeekAppointments?.filter(a => a.status === 'no_show').length || 0
    const thisWeekAttendance = thisWeekTotal > 0 ? ((thisWeekCompleted / (thisWeekCompleted + thisWeekNoShow)) * 100) || 0 : 0

    const lastWeekTotal = lastWeekAppointments?.length || 0
    const lastWeekCompleted = lastWeekAppointments?.filter(a => a.status === 'completed').length || 0
    const lastWeekNoShow = lastWeekAppointments?.filter(a => a.status === 'no_show').length || 0
    const lastWeekAttendance = lastWeekTotal > 0 ? ((lastWeekCompleted / (lastWeekCompleted + lastWeekNoShow)) * 100) || 0 : 0

    const attendanceChange = lastWeekAttendance > 0
      ? ((thisWeekAttendance - lastWeekAttendance) / lastWeekAttendance * 100)
      : 0

    // Get total patients
    let patientsQuery = supabase
      .from('patients')
      .select('id', { count: 'exact' })
      .eq('is_active', true)

    if (clinicId) {
      patientsQuery = patientsQuery.eq('clinic_id', clinicId)
    }

    const { count: totalPatients } = await patientsQuery

    // Get doctors with weekly stats
    let doctorsQuery = supabase
      .from('doctors')
      .select('id, name, specialty, color')
      .eq('is_active', true)

    if (clinicId) {
      doctorsQuery = doctorsQuery.eq('clinic_id', clinicId)
    }

    const { data: doctors } = await doctorsQuery

    // Get appointments per doctor this week, today, AND month
    const doctorStats = await Promise.all(
      (doctors || []).map(async (doctor) => {
        // This week's appointments
        const { data: doctorAppointments } = await supabase
          .from('appointments')
          .select('id, status')
          .eq('doctor_id', doctor.id)
          .gte('appointment_date', formatDate(startOfWeek))
          .lte('appointment_date', formatDate(endOfWeek))

        // Today's appointments
        const { data: todayDoctorAppointments } = await supabase
          .from('appointments')
          .select('id, status')
          .eq('doctor_id', doctor.id)
          .eq('appointment_date', formatDate(today))

        // This month's appointments
        const { data: monthDoctorAppointments } = await supabase
          .from('appointments')
          .select('id, status')
          .eq('doctor_id', doctor.id)
          .gte('appointment_date', formatDate(startOfMonth))
          .lte('appointment_date', formatDate(endOfMonth))

        const total = doctorAppointments?.length || 0
        const completed = doctorAppointments?.filter(a => a.status === 'completed').length || 0
        const noShow = doctorAppointments?.filter(a => a.status === 'no_show').length || 0

        const todayTotal = todayDoctorAppointments?.length || 0
        const todayCompleted = todayDoctorAppointments?.filter(a => a.status === 'completed').length || 0
        const todayNoShow = todayDoctorAppointments?.filter(a => a.status === 'no_show').length || 0

        const monthTotal = monthDoctorAppointments?.length || 0
        const monthCompleted = monthDoctorAppointments?.filter(a => a.status === 'completed').length || 0
        const monthNoShow = monthDoctorAppointments?.filter(a => a.status === 'no_show').length || 0

        return {
          ...doctor,
          patientsThisWeek: total,
          completed,
          noShow,
          attendanceRate: total > 0 ? ((completed / (completed + noShow)) * 100) || 0 : 0,
          // Today stats
          appointmentsToday: todayTotal,
          completedToday: todayCompleted,
          noShowToday: todayNoShow,
          // Month stats
          appointmentsThisMonth: monthTotal,
          completedThisMonth: monthCompleted,
          noShowThisMonth: monthNoShow
        }
      })
    )

    // Today's appointments
    let todayQuery = supabase
      .from('appointments')
      .select('id')
      .eq('appointment_date', formatDate(today))

    if (clinicId) {
      todayQuery = todayQuery.eq('clinic_id', clinicId)
    }

    const { data: todayAppointments } = await todayQuery

    // This month's appointments
    let monthQuery = supabase
      .from('appointments')
      .select('id, status')
      .gte('appointment_date', formatDate(startOfMonth))
      .lte('appointment_date', formatDate(endOfMonth))

    if (clinicId) {
      monthQuery = monthQuery.eq('clinic_id', clinicId)
    }

    const { data: thisMonthAppointments } = await monthQuery

    return NextResponse.json({
      metrics: {
        attendanceRate: Math.round(thisWeekAttendance * 10) / 10,
        attendanceChange: Math.round(attendanceChange * 10) / 10,
        totalPatients: totalPatients || 0,
        appointmentsThisWeek: thisWeekTotal,
        appointmentsThisMonth: thisMonthAppointments?.length || 0,
        appointmentsToday: todayAppointments?.length || 0,
        noShows: thisWeekNoShow,
        doctors: doctorStats,
        weekRange: { start: formatDate(startOfWeek), end: formatDate(endOfWeek) },
        today: formatDate(today),
        currentMonth: today.getMonth() + 1,
        currentYear: today.getFullYear()
      }
    })
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
