import { NextResponse } from 'next/server'
import { loginWithPassword } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json()

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Телефон и парола са задължителни' },
        { status: 400 }
      )
    }

    // Normalize phone number - remove spaces, +, leading 0 and add 359
    let normalizedPhone = phone.replace(/[\s\-\+]/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '359' + normalizedPhone.slice(1)
    } else if (!normalizedPhone.startsWith('359')) {
      normalizedPhone = '359' + normalizedPhone
    }

    const { user, sessionToken, error } = await loginWithPassword(normalizedPhone, password)

    if (error || !user || !sessionToken) {
      return NextResponse.json(
        { error: error || 'Грешка при вход' },
        { status: 401 }
      )
    }

    // Auto-assign clinic_id if user doesn't have one
    const { createServerSupabaseClient } = await import('@/lib/supabase')
    const supabase = createServerSupabaseClient()

    if (!user.clinic_id && user.role === 'clinic') {
      // Get the first clinic (default clinic)
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id')
        .limit(1)
        .single()

      if (clinic) {
        // Update user with clinic_id
        await supabase
          .from('users')
          .update({ clinic_id: clinic.id })
          .eq('id', user.id)

        // Update local user object
        user.clinic_id = clinic.id
        console.log(`Auto-assigned clinic_id ${clinic.id} to user ${user.id}`)
      }
    }

    // Store session in database
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token: sessionToken,
        expires_at: sessionExpiry.toISOString()
      })

    // Set session cookies
    const cookieStore = await cookies()

    // Session token for server-side auth
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    })

    // Session data for middleware
    cookieStore.set('session', JSON.stringify({
      userId: user.id,
      role: user.role,
      clinicId: user.clinic_id,
      token: sessionToken,
      expires: sessionExpiry.toISOString()
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    })

    // User info for client-side access
    cookieStore.set('user', JSON.stringify({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      clinic_id: user.clinic_id
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    })

    // Determine redirect URL based on role
    const redirectUrl = user.role === 'clinic' ? '/clinic' : '/'

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      },
      redirectUrl
    })
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { error: 'Неочаквана грешка' },
      { status: 500 }
    )
  }
}
