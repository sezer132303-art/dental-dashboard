import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'

export interface SessionUser {
  id: string
  phone: string
  name: string | null
  email: string | null
  role: 'admin' | 'clinic'
  clinic_id: string | null
}

/**
 * Get the authenticated user from session cookie
 * Works for both admin and clinic users
 * Returns null if not authenticated
 */
export async function getSessionUser(): Promise<SessionUser | null> {
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

    if (!sessionData.userId) {
      return null
    }

    const supabase = createServerSupabaseClient()

    const { data: user, error } = await supabase
      .from('users')
      .select('id, phone, name, email, role, clinic_id')
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
      role: user.role as 'admin' | 'clinic',
      clinic_id: user.clinic_id
    }
  } catch (error) {
    console.error('Error getting session user:', error)
    return null
  }
}

/**
 * Get clinic_id for the current user
 * - Admin users: can access any clinic (returns null to indicate no restriction, or specific clinic if provided)
 * - Clinic users: can only access their assigned clinic
 */
export async function getAuthorizedClinicId(requestedClinicId?: string | null): Promise<{
  clinicId: string | null
  isAdmin: boolean
  error?: string
}> {
  const user = await getSessionUser()

  if (!user) {
    return { clinicId: null, isAdmin: false, error: 'Unauthorized' }
  }

  if (user.role === 'admin') {
    // Admin can access any clinic or all clinics
    return {
      clinicId: requestedClinicId || null,
      isAdmin: true
    }
  }

  if (user.role === 'clinic') {
    if (!user.clinic_id) {
      return { clinicId: null, isAdmin: false, error: 'No clinic assigned' }
    }

    // Clinic user can only access their own clinic
    // Ignore any requested clinic_id
    return {
      clinicId: user.clinic_id,
      isAdmin: false
    }
  }

  return { clinicId: null, isAdmin: false, error: 'Invalid role' }
}
