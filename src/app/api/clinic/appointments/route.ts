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
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const doctorId = searchParams.get('doctorId')
    const offset = (page - 1) * limit

    // Build query with relations
    let query = supabase
      .from('appointments')
      .select(`
        *,
        doctor:doctors(id, name, color, specialty),
        patient:patients(id, name, phone)
      `, { count: 'exact' })
      .eq('clinic_id', clinicId)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })

    // Date range filter
    if (startDate) {
      query = query.gte('appointment_date', startDate)
    }
    if (endDate) {
      query = query.lte('appointment_date', endDate)
    }

    // Doctor filter
    if (doctorId) {
      query = query.eq('doctor_id', doctorId)
    }

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: appointments, count, error } = await query

    if (error) {
      console.error('Appointments fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      appointments: appointments || [],
      total: count || 0,
      page,
      totalPages
    })
  } catch (error) {
    console.error('Clinic appointments error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
