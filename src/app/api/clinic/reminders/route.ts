import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

// GET /api/clinic/reminders - List reminders for clinic
export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get reminders for appointments belonging to this clinic
    let query = supabase
      .from('reminders')
      .select(`
        id,
        type,
        status,
        scheduled_for,
        sent_at,
        error_message,
        created_at,
        appointment:appointments!inner (
          id,
          appointment_date,
          start_time,
          clinic_id,
          patient:patients (id, name, phone),
          doctor:doctors (id, name)
        )
      `)
      .eq('appointment.clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('type', type)
    }

    const { data: reminders, error } = await query

    if (error) {
      console.error('Error fetching reminders:', error)
      return NextResponse.json({ error: 'Грешка при зареждане' }, { status: 500 })
    }

    // Calculate stats
    const { data: stats } = await supabase
      .from('reminders')
      .select(`
        id,
        type,
        status,
        appointment:appointments!inner (clinic_id)
      `)
      .eq('appointment.clinic_id', clinicId)

    const statsSummary = {
      total: stats?.length || 0,
      sent: stats?.filter(r => r.status === 'sent').length || 0,
      pending: stats?.filter(r => r.status === 'pending').length || 0,
      failed: stats?.filter(r => r.status === 'failed').length || 0,
      by24h: stats?.filter(r => r.type === '24h').length || 0,
      by3h: stats?.filter(r => r.type === '3h').length || 0
    }

    return NextResponse.json({
      reminders,
      stats: statsSummary
    })
  } catch (error) {
    console.error('Clinic reminders API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
