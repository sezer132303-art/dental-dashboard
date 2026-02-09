import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    // Find session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', sessionToken)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Get user with clinic info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id, phone, name, email, role, clinic_id, created_at, last_login_at,
        clinics (
          name
        )
      `)
      .eq('id', session.user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Extract clinic name if available
    const clinicName = (user.clinics as any)?.name || null

    return NextResponse.json({ user, clinicName })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
