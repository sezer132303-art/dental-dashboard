import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Липсват задължителни полета' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Паролата трябва да е поне 6 символа' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Find and validate token
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (tokenError || !resetToken) {
      return NextResponse.json({ error: 'Невалиден или изтекъл линк' }, { status: 400 })
    }

    // Check if expired
    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Линкът е изтекъл' }, { status: 400 })
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10)

    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', resetToken.user_id)

    if (updateError) {
      console.error('Update password error:', updateError)
      return NextResponse.json({ error: 'Грешка при смяна на паролата' }, { status: 500 })
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', resetToken.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
