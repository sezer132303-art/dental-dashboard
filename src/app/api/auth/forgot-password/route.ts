import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

const N8N_WEBHOOK_URL = (process.env.N8N_WEBHOOK_URL || 'https://mwqopo2p.rpcld.net/webhook').trim()
// Production URL hardcoded as fallback to ensure links always work
// Use trim() to remove any trailing whitespace from env variable
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://dental-dashboard-nu.vercel.app').trim().replace(/\/$/, '')

// Normalize phone number to international format (359XXXXXXXXX)
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '')

  // Handle Bulgarian format
  if (digits.startsWith('0')) {
    digits = '359' + digits.substring(1)
  }

  // If doesn't start with country code, assume Bulgarian
  if (!digits.startsWith('359') && digits.length === 9) {
    digits = '359' + digits
  }

  return digits
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Телефонът е задължителен' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    console.log('Forgot password request for:', normalizedPhone)

    const supabase = createServerSupabaseClient()

    // Check if user exists - try both normalized and original format
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, phone')
      .or(`phone.eq.${normalizedPhone},phone.eq.${phone}`)
      .limit(1)
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
    console.log('APP_URL:', APP_URL)
    console.log('Reset link:', resetLink)

    // Normalize phone for WhatsApp (must be international format without +)
    const whatsappPhone = normalizePhone(user.phone)
    console.log('Sending password reset to WhatsApp:', whatsappPhone)

    try {
      // Ensure resetLink has no whitespace - trim and verify
      const cleanResetLink = resetLink.trim()
      console.log('Sending clean reset link:', cleanResetLink)
      console.log('Link length:', cleanResetLink.length)

      const webhookResponse = await fetch(`${N8N_WEBHOOK_URL}/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappPhone,
          resetLink: cleanResetLink,
          userName: user.name || 'Потребител'
        })
      })
      const webhookResult = await webhookResponse.text()
      console.log('Webhook response:', webhookResponse.status, webhookResult)
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
