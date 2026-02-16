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

    // Get current week boundaries in Bulgaria timezone
    const bulgariaFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Sofia',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })

    const now = new Date()
    const todayInBulgaria = bulgariaFormatter.format(now)

    // Parse the Bulgaria date
    const [year, month, day] = todayInBulgaria.split('-').map(Number)
    const bulgariaDate = new Date(year, month - 1, day)
    const dayOfWeek = bulgariaDate.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    const startOfWeek = new Date(year, month - 1, day - daysToMonday)
    const endOfWeek = new Date(year, month - 1, day - daysToMonday + 6)

    const formatDate = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    const startDateStr = formatDate(startOfWeek)
    const endDateStr = formatDate(endOfWeek)

    // Get ALL appointments for this clinic
    const { data: allAppointments, error: aptError } = await supabase
      .from('appointments')
      .select('id, appointment_date, start_time, status, patient_id, doctor_id')
      .eq('clinic_id', clinicId)
      .order('appointment_date', { ascending: false })
      .limit(20)

    // Get ALL patients
    const { data: allPatients, count: patientCount } = await supabase
      .from('patients')
      .select('id, name, phone', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .limit(10)

    // Get ALL doctors
    const { data: allDoctors } = await supabase
      .from('doctors')
      .select('id, name, is_active')
      .eq('clinic_id', clinicId)

    // This week appointments
    const thisWeekAppointments = allAppointments?.filter(a =>
      a.appointment_date >= startDateStr && a.appointment_date <= endDateStr
    ) || []

    return NextResponse.json({
      clinicId,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      dateInfo: {
        serverTime: now.toISOString(),
        todayBulgaria: todayInBulgaria,
        weekStart: startDateStr,
        weekEnd: endDateStr,
        dayOfWeek: ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'][dayOfWeek]
      },
      appointments: {
        total: allAppointments?.length || 0,
        thisWeek: thisWeekAppointments.length,
        sample: allAppointments?.slice(0, 5).map(a => ({
          date: a.appointment_date,
          time: a.start_time,
          status: a.status
        }))
      },
      patients: {
        total: patientCount || 0,
        sample: allPatients?.slice(0, 3).map(p => ({
          name: p.name,
          phone: p.phone
        }))
      },
      doctors: {
        total: allDoctors?.length || 0,
        active: allDoctors?.filter(d => d.is_active).length || 0,
        list: allDoctors?.map(d => ({
          name: d.name,
          active: d.is_active
        }))
      },
      error: aptError?.message
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}
