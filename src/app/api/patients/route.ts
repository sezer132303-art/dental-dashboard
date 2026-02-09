import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/patients - List all patients
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')
    const search = searchParams.get('search')

    let query = supabase
      .from('patients')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
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

// POST /api/patients - Create a new patient
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const { name, phone, email, date_of_birth, gender, notes, clinic_id } = body

    if (!name || !phone || !clinic_id) {
      return NextResponse.json(
        { error: 'Име, телефон и клиника са задължителни' },
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

    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        name,
        phone: normalizedPhone,
        email,
        date_of_birth,
        gender,
        notes,
        clinic_id
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
