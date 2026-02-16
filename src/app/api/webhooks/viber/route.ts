import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import crypto from 'crypto'

// Viber REST API webhook
// Handles incoming messages and events

interface ViberWebhookEvent {
  event: string  // 'message', 'subscribed', 'unsubscribed', 'delivered', 'seen', 'failed'
  timestamp: number
  chat_hostname?: string
  message_token?: number
  sender?: {
    id: string
    name: string
    avatar?: string
    language?: string
    country?: string
    api_version?: number
  }
  message?: {
    type: string  // 'text', 'picture', 'video', 'file', 'sticker', 'contact', 'url', 'location'
    text?: string
    media?: string
    file_name?: string
    location?: { lat: number; lon: number }
    contact?: { name: string; phone_number: string }
  }
  user?: {
    id: string
    name: string
    avatar?: string
  }
}

// POST /api/webhooks/viber - Receive Viber events
export async function POST(request: NextRequest) {
  try {
    const body: ViberWebhookEvent = await request.json()

    // Verify signature
    const signature = request.headers.get('x-viber-content-signature')
    if (signature) {
      const isValid = await verifyViberSignature(request, body, signature)
      if (!isValid) {
        console.warn('Viber webhook signature verification failed')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Handle different event types
    switch (body.event) {
      case 'webhook':
        // Webhook registration callback
        console.log('Viber webhook registered successfully')
        return NextResponse.json({ status: 'ok' })

      case 'message':
        await processViberMessage(body)
        break

      case 'subscribed':
        await handleViberSubscription(body, true)
        break

      case 'unsubscribed':
        await handleViberSubscription(body, false)
        break

      case 'delivered':
      case 'seen':
        await updateMessageStatus(body)
        break

      case 'failed':
        console.error('Viber message failed:', body)
        break

      default:
        console.log('Unhandled Viber event:', body.event)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Viber webhook error:', error)
    return NextResponse.json({ status: 'error' })
  }
}

async function verifyViberSignature(
  request: NextRequest,
  body: ViberWebhookEvent,
  signature: string
): Promise<boolean> {
  const supabase = createServerSupabaseClient()

  // Get Viber bot tokens to verify against
  const { data: credentials } = await supabase
    .from('channel_credentials')
    .select('credentials')
    .eq('channel', 'viber')
    .eq('is_active', true)

  if (!credentials?.length) {
    // Check environment variable
    const envToken = process.env.VIBER_BOT_TOKEN
    if (envToken) {
      const rawBody = JSON.stringify(body)
      const expectedSig = crypto
        .createHmac('sha256', envToken)
        .update(rawBody)
        .digest('hex')
      return signature === expectedSig
    }
    return false
  }

  // Check against all configured bot tokens
  const rawBody = JSON.stringify(body)
  for (const cred of credentials) {
    const botToken = (cred.credentials as Record<string, string>).bot_token
    if (botToken) {
      const expectedSig = crypto
        .createHmac('sha256', botToken)
        .update(rawBody)
        .digest('hex')
      if (signature === expectedSig) {
        return true
      }
    }
  }

  return false
}

async function processViberMessage(event: ViberWebhookEvent) {
  const supabase = createServerSupabaseClient()

  if (!event.sender || !event.message) {
    return
  }

  const senderId = event.sender.id
  const senderName = event.sender.name

  // Find clinic with active Viber configuration
  // In multi-clinic setup, you'd need to match by bot token or other identifier
  const { data: credentials } = await supabase
    .from('channel_credentials')
    .select('clinic_id, credentials')
    .eq('channel', 'viber')
    .eq('is_active', true)
    .limit(1)

  if (!credentials?.length) {
    console.warn('No active Viber configuration found')
    return
  }

  const clinicId = credentials[0].clinic_id

  // Extract message content
  let content = ''
  let messageType = 'text'

  switch (event.message.type) {
    case 'text':
      content = event.message.text || ''
      break
    case 'picture':
    case 'video':
    case 'file':
      messageType = event.message.type
      content = event.message.media || `[${event.message.type}]`
      break
    case 'location':
      messageType = 'location'
      content = `[Location: ${event.message.location?.lat}, ${event.message.location?.lon}]`
      break
    case 'contact':
      messageType = 'contact'
      content = `[Contact: ${event.message.contact?.name} - ${event.message.contact?.phone_number}]`
      break
    default:
      content = `[${event.message.type}]`
  }

  if (!content) {
    return
  }

  // Find or create conversation
  const { data: conversationId } = await supabase.rpc('get_or_create_conversation', {
    p_clinic_id: clinicId,
    p_channel: 'viber',
    p_channel_user_id: senderId,
    p_patient_phone: null,
    p_patient_name: senderName
  })

  if (!conversationId) {
    console.error('Failed to get/create Viber conversation')
    return
  }

  // Insert message
  const timestamp = new Date(event.timestamp)
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    direction: 'inbound',
    content,
    message_type: messageType,
    channel_message_id: event.message_token?.toString() || null,
    raw_payload: event,
    sent_at: timestamp.toISOString()
  })

  // Update conversation
  await supabase
    .from('conversations')
    .update({
      last_message_at: timestamp.toISOString(),
      patient_name: senderName
    })
    .eq('id', conversationId)

  console.log(`Viber message logged for clinic ${clinicId}:`, content.substring(0, 50))

  // Forward to n8n for AI processing
  await forwardToN8n(clinicId, senderId, senderName, content, event)
}

async function handleViberSubscription(event: ViberWebhookEvent, subscribed: boolean) {
  const supabase = createServerSupabaseClient()
  const userId = event.user?.id
  const userName = event.user?.name

  if (!userId) return

  // Find clinic
  const { data: credentials } = await supabase
    .from('channel_credentials')
    .select('clinic_id')
    .eq('channel', 'viber')
    .eq('is_active', true)
    .limit(1)

  if (!credentials?.length) return

  const clinicId = credentials[0].clinic_id

  if (subscribed) {
    // Create or update conversation
    await supabase.rpc('get_or_create_conversation', {
      p_clinic_id: clinicId,
      p_channel: 'viber',
      p_channel_user_id: userId,
      p_patient_phone: null,
      p_patient_name: userName
    })
    console.log(`Viber user subscribed: ${userName}`)
  } else {
    // Mark conversation as inactive
    await supabase
      .from('conversations')
      .update({ status: 'cancelled' })
      .eq('clinic_id', clinicId)
      .eq('channel', 'viber')
      .eq('channel_user_id', userId)
    console.log(`Viber user unsubscribed: ${userId}`)
  }
}

async function updateMessageStatus(event: ViberWebhookEvent) {
  if (!event.message_token) return

  const supabase = createServerSupabaseClient()
  const status = event.event === 'seen' ? 'read' : 'delivered'
  const timestamp = new Date(event.timestamp).toISOString()

  await supabase
    .from('messages')
    .update({
      status,
      [event.event === 'seen' ? 'read_at' : 'delivered_at']: timestamp
    })
    .eq('channel_message_id', event.message_token.toString())
}

async function forwardToN8n(
  clinicId: string,
  senderId: string,
  senderName: string,
  message: string,
  rawPayload: ViberWebhookEvent
) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
  if (!n8nWebhookUrl) {
    console.warn('N8N_WEBHOOK_URL not configured')
    return
  }

  try {
    await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'viber',
        clinicId,
        senderId,
        senderName,
        message,
        timestamp: new Date().toISOString(),
        rawPayload
      })
    })
  } catch (error) {
    console.error('Failed to forward Viber message to n8n:', error)
  }
}
