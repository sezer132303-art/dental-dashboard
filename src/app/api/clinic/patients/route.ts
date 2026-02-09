import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

export async function GET() {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    const supabase = createServerSupabaseClient()

    // Get patients/clients
    let query = supabase
      .from('clients')
      .select('*')
      .order('last_contact_at', { ascending: false })

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data: patients, error } = await query

    if (error) {
      console.error('Patients fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
    }

    return NextResponse.json({
      patients: patients || []
    })
  } catch (error) {
    console.error('Clinic patients error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
