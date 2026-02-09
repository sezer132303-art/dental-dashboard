import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (sessionToken) {
      const supabase = createServerSupabaseClient()

      // Delete session from database
      await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionToken)
    }

    // Clear cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('session_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
