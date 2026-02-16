import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
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

    // Get appointments summary
    let appointmentsQuery = supabase
      .from('appointments')
      .select('status, price')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)

    // Always filter by clinic for non-admin users
    if (clinicId) {
      appointmentsQuery = appointmentsQuery.eq('clinic_id', clinicId)
    }

    const { data: appointments } = await appointmentsQuery

    // Get new patients count
    let patientsQuery = supabase
      .from('patients')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')

    if (clinicId) {
      patientsQuery = patientsQuery.eq('clinic_id', clinicId)
    }

    const { count: newPatients } = await patientsQuery

    // Calculate stats
    const stats = {
      period: { startDate, endDate },
      appointments: {
        total: appointments?.length || 0,
        completed: appointments?.filter(a => a.status === 'completed').length || 0,
        cancelled: appointments?.filter(a => a.status === 'cancelled').length || 0,
        noShow: appointments?.filter(a => a.status === 'no_show').length || 0,
        scheduled: appointments?.filter(a => a.status === 'scheduled').length || 0,
        confirmed: appointments?.filter(a => a.status === 'confirmed').length || 0
      },
      revenue: {
        total: appointments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0,
        completed: appointments?.filter(a => a.status === 'completed').reduce((sum, a) => sum + (a.price || 0), 0) || 0
      },
      newPatients: newPatients || 0,
      attendanceRate: appointments?.length
        ? ((appointments.filter(a => a.status === 'completed').length / appointments.length) * 100).toFixed(1)
        : '0'
    }

    // Generate CSV report
    const lines = [
      '=== ОТЧЕТ ЗА ПЕРИОДА ===',
      `Период: ${startDate} - ${endDate}`,
      '',
      '=== ЧАСОВЕ ===',
      `Общо часове: ${stats.appointments.total}`,
      `Завършени: ${stats.appointments.completed}`,
      `Отменени: ${stats.appointments.cancelled}`,
      `Неявявания: ${stats.appointments.noShow}`,
      `Предстоящи: ${stats.appointments.scheduled + stats.appointments.confirmed}`,
      `Посещаемост: ${stats.attendanceRate}%`,
      '',
      '=== ПРИХОДИ ===',
      `Общо приходи: ${stats.revenue.total.toFixed(2)} лв`,
      `От завършени: ${stats.revenue.completed.toFixed(2)} лв`,
      '',
      '=== ПАЦИЕНТИ ===',
      `Нови пациенти: ${stats.newPatients}`
    ]

    const csv = lines.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${startDate}-${endDate}.txt"`
      }
    })
  } catch (error) {
    console.error('Report API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
