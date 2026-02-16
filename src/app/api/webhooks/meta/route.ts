import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import crypto from 'crypto'

// Meta Graph API webhook for Messenger and Instagram
// Handles both verification and incoming messages

interface MetaWebhookEntry {
  id: string
  time: number
  messaging?: MetaMessagingEvent[]
}

interface MetaMessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: Array<{
      type: string
      payload: { url: string }
    }>
  }
  postback?: {
    title: string
    payload: string
  }
}

// GET /api/webhooks/meta - Webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe') {
    // Look up verify token from any clinic's credentials
    const supabase = createServerSupabaseClient()
    const { data: credentials } = await supabase
      .from('channel_credentials')
      .select('credentials')
      .in('channel', ['messenger', 'instagram'])
      .eq('is_active', true)

    // Check if any clinic has this verify token
    const validToken = credentials?.some(cred => {
      const creds = cred.credentials as Record<string, string>
      return creds.verify_token === token
    })

    // Also check environment variable as fallback
    if (validToken || token === process.env.META_VERIFY_TOKEN) {
      console.log('Meta webhook verified successfully')
      return new NextResponse(challenge, { status: 200 })
    }

    console.warn('Meta webhook verification failed - invalid token')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
}

// POST /api/webhooks/meta - Receive messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify signature if app secret is configured
    const signature = request.headers.get('x-hub-signature-256')
    if (signature && process.env.META_APP_SECRET) {
      const rawBody = JSON.stringify(body)
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', process.env.META_APP_SECRET)
        .update(rawBody)
        .digest('hex')

      if (signature !== expectedSignature) {
        console.warn('Meta webhook signature mismatch')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Process webhook object
    if (body.object === 'page' || body.object === 'instagram') {
      const entries: MetaWebhookEntry[] = body.entry || []

      for (const entry of entries) {
        const pageId = entry.id
        const messaging = entry.messaging || []

        for (const event of messaging) {
          await processMetaMessage(pageId, event, body.object === 'instagram' ? 'instagram' : 'messenger')
        }
      }
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Meta webhook error:', error)
    // Still return 200 to prevent retries
    return NextResponse.json({ status: 'error' })
  }
}

async function processMetaMessage(
  pageId: string,
  event: MetaMessagingEvent,
  channel: 'messenger' | 'instagram'
) {
  const supabase = createServerSupabaseClient()

  // Find clinic by page_id
  const { data: credential } = await supabase
    .from('channel_credentials')
    .select('clinic_id, credentials')
    .eq('channel', channel)
    .eq('is_active', true)

  // Match by page_id in credentials
  const matchingCred = credential?.find(c => {
    const creds = c.credentials as Record<string, string>
    return creds.page_id === pageId
  })

  if (!matchingCred) {
    console.warn(`No clinic found for ${channel} page_id:`, pageId)
    return
  }

  const clinicId = matchingCred.clinic_id
  const senderId = event.sender.id
  const timestamp = new Date(event.timestamp)

  // Get message content
  let content = ''
  let messageType = 'text'

  if (event.message?.text) {
    content = event.message.text
  } else if (event.message?.attachments?.length) {
    const attachment = event.message.attachments[0]
    messageType = attachment.type
    content = attachment.payload?.url || `[${attachment.type}]`
  } else if (event.postback) {
    content = event.postback.payload || event.postback.title
    messageType = 'postback'
  }

  if (!content) {
    return
  }

  // Find or create conversation using the DB function
  const { data: conversationId } = await supabase.rpc('get_or_create_conversation', {
    p_clinic_id: clinicId,
    p_channel: channel,
    p_channel_user_id: senderId,
    p_patient_phone: null,
    p_patient_name: null
  })

  if (!conversationId) {
    console.error('Failed to get/create conversation')
    return
  }

  // Insert message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    direction: 'inbound',
    content,
    message_type: messageType,
    channel_message_id: event.message?.mid || null,
    raw_payload: event,
    sent_at: timestamp.toISOString()
  })

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: timestamp.toISOString() })
    .eq('id', conversationId)

  console.log(`${channel} message logged for clinic ${clinicId}:`, content.substring(0, 50))

  // Forward to n8n webhook for AI processing
  await forwardToN8n(clinicId, channel, senderId, content, event)
}

async function forwardToN8n(
  clinicId: string,
  channel: 'messenger' | 'instagram',
  senderId: string,
  message: string,
  rawPayload: MetaMessagingEvent
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
        source: channel,
        clinicId,
        senderId,
        message,
        timestamp: new Date().toISOString(),
        rawPayload
      })
    })
  } catch (error) {
    console.error('Failed to forward to n8n:', error)
  }
}
