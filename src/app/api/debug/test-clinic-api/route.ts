import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId, getSessionUser } from '@/lib/session-auth'

// Debug endpoint to test clinic API auth
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '2026-02-10'
    const endDate = searchParams.get('endDate') || '2026-02-28'

    // Check auth status
    const sessionUser = await getSessionUser()
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    // Get appointments
    const supabase = createServerSupabaseClient()
    let query = supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        status,
        clinic_id,
        doctor:doctors(id, name, color),
        patient:patients(id, name, phone)
      `)
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)
      .order('appointment_date', { ascending: true })

    // Apply clinic filter if we have one
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data: appointments, error: dbError } = await query

    return NextResponse.json({
      auth: {
        sessionUser: sessionUser ? {
          id: sessionUser.id,
          email: sessionUser.email,
          role: sessionUser.role,
          clinic_id: sessionUser.clinic_id
        } : null,
        clinicId,
        isAdmin,
        authError
      },
      query: {
        startDate,
        endDate,
        clinicIdFilter: clinicId
      },
      result: {
        count: appointments?.length || 0,
        dbError: dbError?.message,
        appointments: appointments?.slice(0, 5) || [] // First 5 only
      }
    })
  } catch (error) {
    console.error('Debug test-clinic-api error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
