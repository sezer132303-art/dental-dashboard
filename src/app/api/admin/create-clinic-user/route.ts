import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { name, phone, email, password, clinicId } = await request.json()

    if (!name || !phone || !password || !clinicId) {
      return NextResponse.json(
        { error: 'Всички полета са задължителни' },
        { status: 400 }
      )
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/[\s\-\+]/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '359' + normalizedPhone.slice(1)
    } else if (!normalizedPhone.startsWith('359')) {
      normalizedPhone = '359' + normalizedPhone
    }

    const supabase = createServerSupabaseClient()

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'Потребител с този телефон вече съществува' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with 'clinic' role
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name,
        phone: normalizedPhone,
        email: email || null,
        password_hash: passwordHash,
        role: 'clinic',
        clinic_id: clinicId,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Create user error:', error)
      return NextResponse.json(
        { error: 'Грешка при създаване на потребител: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Create clinic user error:', error)
    return NextResponse.json(
      { error: 'Неочаквана грешка' },
      { status: 500 }
    )
  }
}
