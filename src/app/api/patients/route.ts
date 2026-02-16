import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// GET /api/patients - List patients (requires authentication)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedClinicId = searchParams.get('clinicId')
    const search = searchParams.get('search')

    // Get authorized clinic(s) based on user session
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('patients')
      .select('*')
      .eq('is_active', true)
      .order('name')

    // Non-admin users MUST have a clinic_id filter
    // Admin users can optionally filter by clinic
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    } else if (!isAdmin) {
      // This shouldn't happen due to getAuthorizedClinicId, but safety check
      return NextResponse.json({ error: 'Clinic access required' }, { status: 403 })
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data: patients, error } = await query

    if (error) {
      console.error('Error fetching patients:', error)
      return NextResponse.json({ error: 'Грешка при зареждане на пациенти' }, { status: 500 })
    }

    return NextResponse.json({ patients })
  } catch (error) {
    console.error('Patients API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// POST /api/patients - Create a new patient (requires authentication)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, date_of_birth, gender, notes, clinic_id: requestedClinicId } = body

    // Verify user is authorized and get their clinic
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    // Determine which clinic to create the patient in
    const effectiveClinicId = isAdmin ? (requestedClinicId || clinicId) : clinicId

    if (!effectiveClinicId) {
      return NextResponse.json(
        { error: 'Clinic ID is required' },
        { status: 400 }
      )
    }

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Име и телефон са задължителни' },
        { status: 400 }
      )
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/[\s\-\+]/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '359' + normalizedPhone.slice(1)
    } else if (!normalizedPhone.startsWith('359')) {
      normalizedPhone = '359' + normalizedPhone
    }

    const supabase = createServerSupabaseClient()

    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        name,
        phone: normalizedPhone,
        email,
        date_of_birth,
        gender,
        notes,
        clinic_id: effectiveClinicId
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating patient:', error)
      return NextResponse.json({ error: 'Грешка при създаване на пациент' }, { status: 500 })
    }

    return NextResponse.json({ patient }, { status: 201 })
  } catch (error) {
    console.error('Create patient error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
