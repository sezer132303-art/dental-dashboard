import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/api-auth'

// GET /api/n8n/doctors - Endpoint for n8n to get doctors
// Requires API key authentication via header or query param
export async function GET(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('doctors')
      .select('id, name, clinic_id, calendar_id, is_active')
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
