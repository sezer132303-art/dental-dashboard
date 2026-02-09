import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Липсва токен' })
    }

    const supabase = createServerSupabaseClient()

    // Find token
    const { data: resetToken, error } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (error || !resetToken) {
      return NextResponse.json({ valid: false, error: 'Невалиден линк' })
    }

    // Check if expired
    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Линкът е изтекъл' })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Verify token error:', error)
    return NextResponse.json({ valid: false, error: 'Грешка при проверка' })
  }
}
