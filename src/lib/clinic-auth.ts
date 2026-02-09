import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'

export interface ClinicUser {
  id: string
  phone: string
  name: string | null
  email: string | null
  role: string
  clinic_id: string | null
  clinicName?: string
}

export async function getClinicUser(): Promise<ClinicUser | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')?.value

    if (!sessionCookie) {
      return null
    }

    let sessionData
    try {
      sessionData = JSON.parse(sessionCookie)
    } catch {
      return null
    }

    if (!sessionData.userId || sessionData.role !== 'clinic') {
      return null
    }

    const supabase = createServerSupabaseClient()

    // Get user with clinic info
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        phone,
        name,
        email,
        role,
        clinic_id,
        clinics (
          name
        )
      `)
      .eq('id', sessionData.userId)
      .single()

    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      clinic_id: user.clinic_id,
      clinicName: (user.clinics as any)?.name || null
    }
  } catch (error) {
    console.error('Error getting clinic user:', error)
    return null
  }
}
