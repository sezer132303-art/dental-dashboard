import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://mwqopo2p.rpcld.net/webhook'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Телефонът е задължителен' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('phone', phone)
      .single()

    if (userError || !user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({ success: true })
    }

    // Generate reset token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    // Store token
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString()
      })

    if (tokenError) {
      console.error('Token insert error:', tokenError)
      return NextResponse.json({ error: 'Грешка при създаване на токен' }, { status: 500 })
    }

    // Send WhatsApp message via n8n webhook
    const resetLink = `${APP_URL}/auth/reset-password?token=${token}`

    try {
      await fetch(`${N8N_WEBHOOK_URL}/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          resetLink,
          userName: user.name || 'Потребител'
        })
      })
    } catch (webhookError) {
      console.error('Webhook error:', webhookError)
      // Don't fail the request if webhook fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
