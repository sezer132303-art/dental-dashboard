import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/api-auth'

// Viber REST API - Send Message
// Docs: https://developers.viber.com/docs/api/rest-bot-api/#send-message

interface ViberSendRequest {
  clinicId?: string
  receiverId: string
  message: string
  messageType?: 'text' | 'picture' | 'video' | 'file'
  mediaUrl?: string
  trackingData?: string
}

// POST /api/viber/send - Send Viber message
export async function POST(request: NextRequest) {
  const validation = await validateApiKey(request)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  try {
    const body: ViberSendRequest = await request.json()
    const { clinicId, receiverId, message, messageType = 'text', mediaUrl, trackingData } = body

    if (!receiverId || !message) {
      return NextResponse.json(
        { error: 'receiverId and message are required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Get Viber credentials
    let query = supabase
      .from('channel_credentials')
      .select('clinic_id, credentials')
      .eq('channel', 'viber')
      .eq('is_active', true)

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data: credentials, error: credError } = await query.single()

    // Get bot token (from DB or env)
    let botToken: string
    let botName: string
    let effectiveClinicId: string | null = null

    if (credError || !credentials) {
      botToken = process.env.VIBER_BOT_TOKEN || ''
      botName = process.env.VIBER_BOT_NAME || 'Dental Clinic'

      if (!botToken) {
        return NextResponse.json(
          { error: 'Viber не е конфигуриран' },
          { status: 404 }
        )
      }
    } else {
      const creds = credentials.credentials as Record<string, string>
      botToken = creds.bot_token || ''
      botName = creds.bot_name || 'Dental Clinic'
      effectiveClinicId = credentials.clinic_id

      if (!botToken) {
        return NextResponse.json(
          { error: 'Viber bot token не е конфигуриран' },
          { status: 500 }
        )
      }
    }

    // Build message payload
    const payload: Record<string, unknown> = {
      receiver: receiverId,
      min_api_version: 1,
      sender: { name: botName },
      tracking_data: trackingData,
      type: messageType,
    }

    if (messageType === 'text') {
      payload.text = message
    } else if (['picture', 'video', 'file'].includes(messageType) && mediaUrl) {
      payload.media = mediaUrl
      payload.text = message
    } else {
      payload.type = 'text'
      payload.text = message
    }

    // Send to Viber API
    const response = await fetch('https://chatapi.viber.com/pa/send_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viber-Auth-Token': botToken
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (data.status !== 0) {
      console.error('Viber API error:', data)
      return NextResponse.json(
        { error: data.status_message || 'Viber API error', status: data.status },
        { status: 400 }
      )
    }

    // Log outbound message
    if (effectiveClinicId) {
      const { data: conversationId } = await supabase.rpc('get_or_create_conversation', {
        p_clinic_id: effectiveClinicId,
        p_channel: 'viber',
        p_channel_user_id: receiverId,
        p_patient_phone: null,
        p_patient_name: null
      })

      if (conversationId) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          direction: 'outbound',
          content: message,
          message_type: messageType,
          channel_message_id: data.message_token?.toString() || null,
          status: 'sent',
          sent_at: new Date().toISOString()
        })
      }
    }

    return NextResponse.json({
      success: true,
      messageToken: data.message_token
    })
  } catch (error) {
    console.error('Viber send error:', error)
    return NextResponse.json({ error: 'Грешка при изпращане' }, { status: 500 })
  }
}
