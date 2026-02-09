import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

// GET /api/clinic/doctors - List doctors for the clinic
export async function GET(request: NextRequest) {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    const supabase = createServerSupabaseClient()

    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching doctors:', error)
      return NextResponse.json({ error: 'Грешка при зареждане на лекари' }, { status: 500 })
    }

    return NextResponse.json({ doctors: doctors || [] })
  } catch (error) {
    console.error('Clinic doctors API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
