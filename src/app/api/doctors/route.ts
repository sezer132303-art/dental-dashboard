import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/doctors - List all doctors
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    let query = supabase
      .from('doctors')
      .select('*')
      .eq('is_active', true)
      .order('name')

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
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const { name, specialty, phone, email, clinic_id, color, bio } = body

    if (!name || !clinic_id) {
      return NextResponse.json(
        { error: 'Име и клиника са задължителни' },
        { status: 400 }
      )
    }

    const { data: doctor, error } = await supabase
      .from('doctors')
      .insert({
        name,
        specialty,
        phone,
        email,
        clinic_id,
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
