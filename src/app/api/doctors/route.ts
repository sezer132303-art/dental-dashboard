import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// GET /api/doctors - List doctors for authorized clinic
export async function GET(request: NextRequest) {
  try {
    // Check authentication and get authorized clinic
    const { searchParams } = new URL(request.url)
    const requestedClinicId = searchParams.get('clinicId')

    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    // Non-admin users MUST have a clinic_id
    if (!isAdmin && !clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('doctors')
      .select('*')
      .eq('is_active', true)
      .order('name')

    // Always filter by clinic for non-admin users
    // Admin can optionally filter or see all
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data: doctors, error } = await query

    if (error) {
      console.error('Error fetching doctors:', error)
      return NextResponse.json({ error: 'Грешка при зареждане на лекари' }, { status: 500 })
    }

    return NextResponse.json({ doctors })
  } catch (error) {
    console.error('Doctors API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// POST /api/doctors - Create a new doctor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, specialty, phone, email, clinic_id, color, bio } = body

    // Check authentication and verify clinic access
    const { clinicId: authorizedClinicId, isAdmin, error: authError } = await getAuthorizedClinicId(clinic_id)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    // Determine which clinic_id to use
    const targetClinicId = isAdmin ? clinic_id : authorizedClinicId

    if (!name || !targetClinicId) {
      return NextResponse.json(
        { error: 'Име и клиника са задължителни' },
        { status: 400 }
      )
    }

    // Non-admin trying to create doctor for different clinic
    if (!isAdmin && clinic_id && clinic_id !== authorizedClinicId) {
      return NextResponse.json(
        { error: 'Нямате достъп до тази клиника' },
        { status: 403 }
      )
    }

    const supabase = createServerSupabaseClient()

    const { data: doctor, error } = await supabase
      .from('doctors')
      .insert({
        name,
        specialty,
        phone,
        email,
        clinic_id: targetClinicId,
        color: color || 'bg-blue-500',
        bio
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating doctor:', error)
      return NextResponse.json({ error: 'Грешка при създаване на лекар' }, { status: 500 })
    }

    return NextResponse.json({ doctor }, { status: 201 })
  } catch (error) {
    console.error('Create doctor error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
