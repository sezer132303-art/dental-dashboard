import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

interface DoctorInput {
  id?: string
  name: string
  specialty: string
  calendar_id?: string
}

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
      evolution_api_url, google_calendar_id, doctors
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Името е задължително' }, { status: 400 })
    }

    // Support both old format (doctor_name) and new format (doctors array)
    const doctorsList: DoctorInput[] = doctors || []
    if (body.doctor_name && doctorsList.length === 0) {
      doctorsList.push({
        name: body.doctor_name,
        specialty: body.doctor_specialty || 'Зъболекар',
        calendar_id: ''
      })
    }

    if (doctorsList.length === 0 || !doctorsList.some(d => d.name?.trim())) {
      return NextResponse.json({ error: 'Моля, добавете поне един лекар' }, { status: 400 })
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

    // Create doctors for this clinic
    const validDoctors = doctorsList.filter(d => d.name?.trim())
    if (validDoctors.length > 0) {
      const doctorsToInsert = validDoctors.map(d => ({
        clinic_id: clinic.id,
        name: d.name.trim(),
        specialty: d.specialty || 'Зъболекар',
        calendar_id: d.calendar_id?.trim() || null,
        is_active: true
      }))

      const { error: doctorError } = await supabase
        .from('doctors')
        .insert(doctorsToInsert)

      if (doctorError) {
        console.error('Create doctors error:', doctorError)
        // Don't fail the whole request, just log
      }
    }

    return NextResponse.json(clinic)
  } catch (error) {
    console.error('Create clinic API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
