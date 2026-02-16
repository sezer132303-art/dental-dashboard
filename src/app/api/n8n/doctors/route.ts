import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/n8n/doctors - Public endpoint for n8n to get doctors
// This endpoint is specifically for n8n workflows and returns all active doctors
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('doctors')
      .select('id, name, clinic_id, google_calendar_id, is_active')
      .eq('is_active', true)
      .order('name')

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data: doctors, error } = await query

    if (error) {
      console.error('Error fetching doctors for n8n:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ doctors })
  } catch (error) {
    console.error('n8n doctors API error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
