import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    let previousStartDate: Date
    let previousEndDate: Date

    switch (period) {
      case 'week':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        previousEndDate = new Date(startDate)
        previousEndDate.setDate(previousEndDate.getDate() - 1)
        previousStartDate = new Date(previousEndDate)
        previousStartDate.setDate(previousStartDate.getDate() - 7)
        break
      case 'quarter':
        startDate = new Date(now)
        startDate.setMonth(now.getMonth() - 3)
        previousEndDate = new Date(startDate)
        previousEndDate.setDate(previousEndDate.getDate() - 1)
        previousStartDate = new Date(previousEndDate)
        previousStartDate.setMonth(previousStartDate.getMonth() - 3)
        break
      default: // month
        startDate = new Date(now)
        startDate.setMonth(now.getMonth() - 1)
        previousEndDate = new Date(startDate)
        previousEndDate.setDate(previousEndDate.getDate() - 1)
        previousStartDate = new Date(previousEndDate)
        previousStartDate.setMonth(previousStartDate.getMonth() - 1)
    }

    const formatDate = (d: Date) => d.toISOString()

    // Get appointments for current period
    let currentQuery = supabase
      .from('appointments')
      .select('*')
      .gte('appointment_datetime', formatDate(startDate))
      .lte('appointment_datetime', formatDate(now))

    if (clinicId) {
      currentQuery = currentQuery.eq('clinic_id', clinicId)
    }

    const { data: currentAppointments } = await currentQuery

    // Get appointments for previous period
    let previousQuery = supabase
      .from('appointments')
      .select('*')
      .gte('appointment_datetime', formatDate(previousStartDate))
      .lte('appointment_datetime', formatDate(previousEndDate))

    if (clinicId) {
      previousQuery = previousQuery.eq('clinic_id', clinicId)
    }

    const { data: previousAppointments } = await previousQuery

    // Calculate metrics
    const totalAppointments = currentAppointments?.length || 0
    const completedAppointments = currentAppointments?.filter(a => a.status === 'completed').length || 0
    const cancelledAppointments = currentAppointments?.filter(a => a.status === 'cancelled').length || 0
    const noShows = currentAppointments?.filter(a => a.status === 'no-show').length || 0

    // Attendance rates
    const attended = completedAppointments
    const shouldHaveAttended = completedAppointments + noShows
    const attendanceRate = shouldHaveAttended > 0
      ? Math.round((attended / shouldHaveAttended) * 100)
      : 100

    const prevAttended = previousAppointments?.filter(a => a.status === 'completed').length || 0
    const prevNoShows = previousAppointments?.filter(a => a.status === 'no-show').length || 0
    const prevShouldHaveAttended = prevAttended + prevNoShows
    const previousAttendanceRate = prevShouldHaveAttended > 0
      ? Math.round((prevAttended / prevShouldHaveAttended) * 100)
      : 100

    // New patients in period
    let newPatientsQuery = supabase
      .from('clients')
      .select('phone', { count: 'exact' })
      .gte('first_contact_at', formatDate(startDate))

    if (clinicId) {
      newPatientsQuery = newPatientsQuery.eq('clinic_id', clinicId)
    }

    const { count: newPatients } = await newPatientsQuery

    // Appointments by day of week
    const dayNames = ['Нед', 'Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб']
    const appointmentsByDay = dayNames.map((day, index) => {
      const count = currentAppointments?.filter(a => {
        const date = new Date(a.appointment_datetime)
        return date.getDay() === index
      }).length || 0
      return { day, count }
    })

    // Appointments by service
    const serviceCount: Record<string, number> = {}
    currentAppointments?.forEach(a => {
      const service = a.service || 'Други'
      serviceCount[service] = (serviceCount[service] || 0) + 1
    })
    const appointmentsByService = Object.entries(serviceCount)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      period,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShows,
      newPatients: newPatients || 0,
      attendanceRate,
      previousAttendanceRate,
      appointmentsByDay,
      appointmentsByService
    })
  } catch (error) {
    console.error('Clinic reports error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
