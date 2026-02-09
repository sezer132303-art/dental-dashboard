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

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('appointments')
      .select('*', { count: 'exact' })
      .order('appointment_datetime', { ascending: false })
      .range(offset, offset + limit - 1)

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

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
