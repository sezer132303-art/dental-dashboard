import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/api-auth'

// GET /api/n8n/availability?date=2026-02-10&doctorId=xxx&clinicId=xxx
// Returns doctors with their calendar_id for n8n calendar sync
export async function GET(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const doctorId = searchParams.get('doctorId')
    const date = searchParams.get('date') // YYYY-MM-DD
    const clinicId = searchParams.get('clinicId')

    if (!date) {
      return NextResponse.json(
        { error: 'Missing required parameter: date' },
        { status: 400 }
      )
    }

    // Get doctors (optionally filtered by doctorId and/or clinicId)
    let doctorsQuery = supabase
      .from('doctors')
      .select('id, name, specialty, color, calendar_id, clinic_id')
      .eq('is_active', true)

    // Only filter by clinic if provided
    if (clinicId) {
      doctorsQuery = doctorsQuery.eq('clinic_id', clinicId)
    }

    if (doctorId) {
      doctorsQuery = doctorsQuery.eq('id', doctorId)
    }

    const { data: doctors, error: doctorsError } = await doctorsQuery

    if (doctorsError) {
      console.error('Doctors query error:', doctorsError)
      return NextResponse.json({
        available: false,
        message: 'Грешка при заявка за лекари',
        slots: [],
        doctors: []
      })
    }

    if (!doctors?.length) {
      return NextResponse.json({
        available: false,
        message: 'Няма налични лекари',
        slots: [],
        doctors: []
      })
    }

    // Return doctors list - slot calculation removed since working_hours doesn't exist
    return NextResponse.json({
      available: true,
      slotsCount: 0,
      slots: [],
      doctors: doctors.map(d => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        color: d.color,
        calendar_id: d.calendar_id,
        clinic_id: d.clinic_id
      }))
    })

  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}
