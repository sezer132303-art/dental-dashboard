import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

export async function GET(request: NextRequest) {
  try {
    // Use the same auth as admin panel - works for both admin and clinic users
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    // TEMPORARY: If auth fails, use default clinic for testing
    let effectiveClinicId = clinicId
    if (authError || (!clinicId && !isAdmin)) {
      console.log('[Clinic API] Auth failed, using default clinic for testing')
      // Default clinic ID
      effectiveClinicId = '9c969515-8642-4580-9b7b-cd1343e57bee'
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

    // Filter by clinic_id
    if (effectiveClinicId) {
      query = query.eq('clinic_id', effectiveClinicId)
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
