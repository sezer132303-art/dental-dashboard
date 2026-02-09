import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { token, checkOnly } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Токенът е задължителен' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Find and validate token
    const { data: authToken, error: tokenError } = await supabase
      .from('auth_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (tokenError || !authToken) {
      return NextResponse.json(
        { error: 'Невалиден или изтекъл линк' },
        { status: 401 }
      )
    }

    // Check if expired
    if (new Date(authToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Линкът е изтекъл' },
        { status: 401 }
      )
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', authToken.phone)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Потребителят не е намерен' },
        { status: 404 }
      )
    }

    // If just checking, return whether user needs to set password
    if (checkOnly) {
      return NextResponse.json({
        success: true,
        needsPassword: !user.password_hash,
        userName: user.name
      })
    }

    // Mark token as used
    await supabase
      .from('auth_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', authToken.id)

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    // Generate session token
    const sessionToken = crypto.randomUUID()
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    // Set session cookie with proper JSON format for middleware
    const cookieStore = await cookies()
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

    // Store user info in cookie for client access
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

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        clinicId: user.clinic_id
      }
    })
  } catch (error) {
    console.error('Verify token error:', error)
    return NextResponse.json(
      { error: 'Неочаквана грешка' },
      { status: 500 }
    )
  }
}
