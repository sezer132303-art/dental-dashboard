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
      .select('id, is_active, clinic_id')
      .eq('phone', normalizedPhone)
      .maybeSingle()

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // If user exists
    if (existingUser) {
      // Check if this user belongs to the SAME clinic we're creating for AND is active
      if (existingUser.clinic_id === clinicId && existingUser.is_active) {
        return NextResponse.json(
          { error: 'Потребител с този телефон вече съществува в тази клиника' },
          { status: 400 }
        )
      }

      // User exists for a different/deleted clinic - free up the phone number
      // We can't delete due to potential foreign key constraints (appointments.created_by)
      // Instead, we'll update the old user's phone to a unique archived value
      const archivedPhone = `archived_${Date.now()}_${existingUser.phone}`
      const { error: archiveError } = await supabase
        .from('users')
        .update({
          phone: archivedPhone,
          is_active: false
        })
        .eq('id', existingUser.id)

      if (archiveError) {
        console.error('Archive old user error:', archiveError)
        return NextResponse.json(
          { error: 'Грешка при архивиране на стар потребител: ' + archiveError.message },
          { status: 500 }
        )
      }

      console.log(`Archived old user ${existingUser.id} with phone ${existingUser.phone} -> ${archivedPhone}`)
    }

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
