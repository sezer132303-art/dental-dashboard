import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// Debug endpoint to check appointments in database
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('startDate') || '2026-02-01'
    const endDate = searchParams.get('endDate') || '2026-02-28'

    // Get all appointments without any auth filter
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        status,
        clinic_id,
        doctor_id,
        patient_id,
        doctor:doctors(id, name),
        patient:patients(id, name, phone)
      `)
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)
      .order('appointment_date', { ascending: true })
      .limit(50)

    if (error) {
      return NextResponse.json({
        error: error.message,
        hint: error.hint,
        details: error.details
      }, { status: 500 })
    }

    // Get clinic info
    const { data: clinics } = await supabase
      .from('clinics')
      .select('id, name')

    return NextResponse.json({
      total: appointments?.length || 0,
      dateRange: { startDate, endDate },
      clinics: clinics || [],
      appointments: appointments || []
    })
  } catch (error) {
    console.error('Debug appointments error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
