import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

export async function GET(request: NextRequest) {
  try {
    // Use the same auth as admin panel - works for both admin and clinic users
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    // For non-admin users, clinic_id is required
    if (!clinicId && !isAdmin) {
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
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })

    // Filter by clinic_id (admin can see all if no clinicId specified)
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

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
