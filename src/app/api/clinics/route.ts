import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data: clinics, error } = await supabase
      .from('clinics')
      .select(`
        *,
        doctors:doctors(count),
        patients:patients(count),
        appointments:appointments(count)
      `)
      .order('name')

    if (error) {
      console.error('Fetch clinics error:', error)
      return NextResponse.json({ error: 'Грешка при зареждане' }, { status: 500 })
    }

    // Transform data
    const transformedClinics = clinics?.map(clinic => ({
      id: clinic.id,
      name: clinic.name,
      whatsapp_instance: clinic.whatsapp_instance,
      created_at: clinic.created_at,
      doctors: clinic.doctors?.[0]?.count || 0,
      patients: clinic.patients?.[0]?.count || 0,
      appointments: clinic.appointments?.[0]?.count || 0
    })) || []

    return NextResponse.json(transformedClinics)
  } catch (error) {
    console.error('Clinics API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, whatsapp_instance } = body

    if (!name) {
      return NextResponse.json({ error: 'Името е задължително' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    const { data: clinic, error } = await supabase
      .from('clinics')
      .insert({ name, whatsapp_instance })
      .select()
      .single()

    if (error) {
      console.error('Create clinic error:', error)
      return NextResponse.json({ error: 'Грешка при създаване' }, { status: 500 })
    }

    return NextResponse.json(clinic)
  } catch (error) {
    console.error('Create clinic API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
