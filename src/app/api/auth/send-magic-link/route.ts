import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://mwqopo2p.rpcld.net/webhook'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json(
        { error: 'Телефонният номер е задължителен' },
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

    const supabase = createServerSupabaseClient()

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', normalizedPhone)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Телефонният номер не е регистриран' },
        { status: 404 }
      )
    }

    // Generate unique token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Store token in database
    const { error: tokenError } = await supabase
      .from('auth_tokens')
      .insert({
        phone: normalizedPhone,
        token,
        expires_at: expiresAt.toISOString()
      })

    if (tokenError) {
      console.error('Token insert error:', tokenError)
      return NextResponse.json(
        { error: 'Грешка при създаване на токен' },
        { status: 500 }
      )
    }

    // Send WhatsApp message via n8n webhook
    const magicLink = `${APP_URL}/auth/verify?token=${token}`

    try {
      const response = await fetch(`${N8N_WEBHOOK_URL}/send-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone,
          token,
          magicLink,
          userName: user.name || 'Потребител'
        })
      })

      if (!response.ok) {
        console.error('n8n webhook error:', await response.text())
        return NextResponse.json(
          { error: 'Грешка при изпращане на съобщението' },
          { status: 500 }
        )
      }
    } catch (webhookError) {
      console.error('Webhook error:', webhookError)
      // For development, continue even if webhook fails
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Грешка при изпращане на съобщението' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send magic link error:', error)
    return NextResponse.json(
      { error: 'Неочаквана грешка' },
      { status: 500 }
    )
  }
}
