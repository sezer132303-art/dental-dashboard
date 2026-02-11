import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

// GET /api/clinic/profile - Get clinic profile for logged-in clinic user
export async function GET() {
  try {
    const user = await getClinicUser()

    if (!user || !user.clinic_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    // Fetch clinic with all details
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select(`
        *,
        doctors:doctors(id, name, specialty, calendar_id, is_active)
      `)
      .eq('id', user.clinic_id)
      .single()

    if (error) {
      console.error('Fetch clinic profile error:', error)
      return NextResponse.json({ error: 'Грешка при зареждане на профил' }, { status: 500 })
    }

    // Get counts
    const [patientsRes, appointmentsRes] = await Promise.all([
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', user.clinic_id),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', user.clinic_id)
    ])

    return NextResponse.json({
      ...clinic,
      patientsCount: patientsRes.count || 0,
      appointmentsCount: appointmentsRes.count || 0,
      admin: {
        id: user.id,
        name: user.name,
        phone: user.phone
      }
    })
  } catch (error) {
    console.error('Clinic profile API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// PATCH /api/clinic/profile - Update clinic profile
export async function PATCH(request: Request) {
  try {
    const user = await getClinicUser()

    if (!user || !user.clinic_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createServerSupabaseClient()

    // Build update object with only provided fields
    const updateData: Record<string, any> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.address !== undefined) updateData.address = body.address
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.whatsapp_instance !== undefined) updateData.whatsapp_instance = body.whatsapp_instance
    if (body.whatsapp_api_key !== undefined) updateData.whatsapp_api_key = body.whatsapp_api_key
    if (body.evolution_api_url !== undefined) updateData.evolution_api_url = body.evolution_api_url
    if (body.google_calendar_id !== undefined) updateData.google_calendar_id = body.google_calendar_id
    if (body.google_calendars !== undefined) updateData.google_calendars = body.google_calendars
    if (body.google_service_account !== undefined) updateData.google_service_account = body.google_service_account

    // Update clinic
    const { data: clinic, error } = await supabase
      .from('clinics')
      .update(updateData)
      .eq('id', user.clinic_id)
      .select()
      .single()

    if (error) {
      console.error('Update clinic profile error:', error)
      return NextResponse.json({ error: 'Грешка при запазване' }, { status: 500 })
    }

    return NextResponse.json(clinic)
  } catch (error) {
    console.error('Update clinic profile API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
