import { NextResponse } from 'next/server'
import { setPassword, verifyMagicLink } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Токен и парола са задължителни' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Паролата трябва да е поне 6 символа' },
        { status: 400 }
      )
    }

    // Verify the magic link token first
    const { user, sessionToken, error: verifyError } = await verifyMagicLink(token)

    if (verifyError || !user) {
      return NextResponse.json(
        { error: verifyError || 'Невалиден токен' },
        { status: 401 }
      )
    }

    // Set the password
    const { success, error: setError } = await setPassword(user.phone, password)

    if (!success) {
      return NextResponse.json(
        { error: setError || 'Грешка при задаване на парола' },
        { status: 500 }
      )
    }

    // Set session cookie with proper JSON format for middleware
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
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
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    })

    return NextResponse.json({
      success: true,
      message: 'Паролата е зададена успешно'
    })
  } catch (error) {
    console.error('Set password API error:', error)
    return NextResponse.json(
      { error: 'Неочаквана грешка' },
      { status: 500 }
    )
  }
}
