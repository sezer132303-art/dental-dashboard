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
      google_calendar_id: clinic.google_calendar_id,
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
    const {
      name, address, phone, whatsapp_instance, whatsapp_api_key,
      evolution_api_url, google_calendar_id, doctor_name, doctor_specialty
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Името е задължително' }, { status: 400 })
    }

    if (!doctor_name) {
      return NextResponse.json({ error: 'Името на лекаря е задължително' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Create clinic
    const insertData: Record<string, any> = { name }
    if (address) insertData.address = address
    if (phone) insertData.phone = phone
    if (whatsapp_instance) insertData.whatsapp_instance = whatsapp_instance
    if (whatsapp_api_key) insertData.whatsapp_api_key = whatsapp_api_key
    if (evolution_api_url) insertData.evolution_api_url = evolution_api_url
    if (google_calendar_id) insertData.google_calendar_id = google_calendar_id

    const { data: clinic, error } = await supabase
      .from('clinics')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Create clinic error:', error)
      return NextResponse.json({ error: 'Грешка при създаване' }, { status: 500 })
    }

    // Create doctor for this clinic
    const { error: doctorError } = await supabase
      .from('doctors')
      .insert({
        clinic_id: clinic.id,
        name: doctor_name,
        specialty: doctor_specialty || 'Зъболекар',
        is_active: true
      })

    if (doctorError) {
      console.error('Create doctor error:', doctorError)
      // Don't fail the whole request, just log
    }

    return NextResponse.json(clinic)
  } catch (error) {
    console.error('Create clinic API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
