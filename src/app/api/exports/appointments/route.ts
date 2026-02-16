import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const requestedClinicId = searchParams.get('clinicId')
    const status = searchParams.get('status')

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

    let query = supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        status,
        type,
        notes,
        price,
        created_at,
        patients!inner(name, phone),
        doctors!inner(name)
      `)
      .order('appointment_date', { ascending: false })

    if (startDate) {
      query = query.gte('appointment_date', startDate)
    }
    if (endDate) {
      query = query.lte('appointment_date', endDate)
    }
    // Always filter by clinic for non-admin users
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data: appointments, error } = await query

    if (error) {
      console.error('Export error:', error)
      return NextResponse.json({ error: 'Грешка при експорт' }, { status: 500 })
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Дата', 'Час', 'Пациент', 'Телефон', 'Лекар', 'Процедура', 'Статус', 'Цена']
      const rows = appointments?.map((apt: any) => {
        const patient = apt.patients as { name: string; phone: string } | null
        const doctor = apt.doctors as { name: string } | null
        return [
          apt.appointment_date,
          `${apt.start_time}-${apt.end_time}`,
          patient?.name || '',
          patient?.phone || '',
          doctor?.name || '',
          apt.type || '',
          translateStatus(apt.status),
          apt.price ? `${apt.price} лв` : ''
        ]
      }) || []

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="appointments-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // JSON format
    return NextResponse.json(appointments)
  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    scheduled: 'Запазен',
    confirmed: 'Потвърден',
    completed: 'Завършен',
    cancelled: 'Отменен',
    no_show: 'Неявяване'
  }
  return translations[status] || status
}
