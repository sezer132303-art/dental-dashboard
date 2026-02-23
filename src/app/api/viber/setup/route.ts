import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// Viber REST API - Set Webhook & Account Info
// Docs: https://developers.viber.com/docs/api/rest-bot-api/#setting-a-webhook

interface ViberSetupRequest {
  action: 'register' | 'unregister' | 'info'
  botToken?: string
  botName?: string
}

// POST /api/viber/setup - Register/unregister Viber webhook
export async function POST(request: NextRequest) {
  try {
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    if (!clinicId && !isAdmin) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const body: ViberSetupRequest = await request.json()
    const { action, botToken, botName } = body

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    // Get bot token from request or database
    let token = botToken

    if (!token) {
      const supabase = createServerSupabaseClient()
      const { data: creds } = await supabase
        .from('channel_credentials')
        .select('credentials')
        .eq('clinic_id', clinicId)
        .eq('channel', 'viber')
        .single()

      if (creds) {
        token = (creds.credentials as Record<string, string>).bot_token
      } else {
        token = process.env.VIBER_BOT_TOKEN
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Bot token е задължителен' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'register':
        return await registerWebhook(token, botName || 'Dental Clinic', clinicId)

      case 'unregister':
        return await unregisterWebhook(token)

      case 'info':
        return await getAccountInfo(token)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Viber setup error:', error)
    return NextResponse.json({ error: 'Грешка при настройка' }, { status: 500 })
  }
}

async function registerWebhook(
  botToken: string,
  botName: string,
  clinicId: string | null
): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL не е конфигуриран' },
      { status: 500 }
    )
  }

  const webhookUrl = `${appUrl}/api/webhooks/viber`

  const response = await fetch('https://chatapi.viber.com/pa/set_webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Viber-Auth-Token': botToken
    },
    body: JSON.stringify({
      url: webhookUrl,
      event_types: [
        'delivered',
        'seen',
        'failed',
        'subscribed',
        'unsubscribed',
        'conversation_started'
      ],
      send_name: true,
      send_photo: true
    })
  })

  const data = await response.json()

  if (data.status !== 0) {
    console.error('Viber set_webhook error:', data)
    return NextResponse.json(
      { error: data.status_message || 'Failed to register webhook' },
      { status: 400 }
    )
  }

  // Save credentials to database
  if (clinicId) {
    const supabase = createServerSupabaseClient()
    await supabase
      .from('channel_credentials')
      .upsert({
        clinic_id: clinicId,
        channel: 'viber',
        is_active: true,
        credentials: {
          bot_token: botToken,
          bot_name: botName
        },
        webhook_url: webhookUrl,
        last_verified_at: new Date().toISOString()
      }, {
        onConflict: 'clinic_id,channel'
      })
  }

  return NextResponse.json({
    success: true,
    webhookUrl,
    eventTypes: data.event_types
  })
}

async function unregisterWebhook(botToken: string): Promise<NextResponse> {
  const response = await fetch('https://chatapi.viber.com/pa/set_webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Viber-Auth-Token': botToken
    },
    body: JSON.stringify({
      url: ''
    })
  })

  const data = await response.json()

  if (data.status !== 0) {
    console.error('Viber unregister error:', data)
    return NextResponse.json(
      { error: data.status_message || 'Failed to unregister webhook' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Webhook unregistered'
  })
}

async function getAccountInfo(botToken: string): Promise<NextResponse> {
  const response = await fetch('https://chatapi.viber.com/pa/get_account_info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Viber-Auth-Token': botToken
    }
  })

  const data = await response.json()

  if (data.status !== 0) {
    console.error('Viber get_account_info error:', data)
    return NextResponse.json(
      { error: data.status_message || 'Failed to get account info' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    account: {
      id: data.id,
      name: data.name,
      uri: data.uri,
      icon: data.icon,
      background: data.background,
      category: data.category,
      subcategory: data.subcategory,
      location: data.location,
      country: data.country,
      webhook: data.webhook,
      eventTypes: data.event_types,
      subscribersCount: data.subscribers_count
    }
  })
}
