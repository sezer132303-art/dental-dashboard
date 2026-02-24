import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey, getDefaultClinicId } from '@/lib/api-auth'

type MessagingChannel = 'whatsapp' | 'messenger' | 'instagram' | 'viber'

// POST /api/n8n/log-conversation
// Supports multi-channel messaging: WhatsApp, Messenger, Instagram, Viber
// Falls back to legacy WhatsApp tables if unified tables don't exist
export async function POST(request: NextRequest) {
  const validation = await validateApiKey(request)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient()

    // Parse JSON body with error handling
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON body', details: String(parseError) },
        { status: 400 }
      )
    }

    // Log incoming request for debugging
    console.log('log-conversation request:', JSON.stringify(body, null, 2))

    const {
      clinicId,
      channel = 'whatsapp',  // NEW: channel type (default: whatsapp for backward compatibility)
      channelUserId,         // NEW: platform-specific user ID (PSID for Meta, phone for WhatsApp/Viber)
      instanceName,          // WhatsApp instance name from Evolution API (legacy support)
      patientPhone,          // Legacy field, still supported
      patientName,           // NEW: patient name if available
      direction,             // 'inbound' or 'outbound'
      content,
      messageType,           // 'text', 'image', etc.
      parsedIntent,
      rawPayload,
      messageId              // Platform-specific message ID
    } = body

    // Validate required fields
    const userIdentifier = channelUserId || patientPhone
    if (!userIdentifier || !content || !direction) {
      return NextResponse.json(
        { error: 'Липсват задължителни полета: channelUserId/patientPhone, content, direction' },
        { status: 400 }
      )
    }

    // Validate channel
    const validChannels: MessagingChannel[] = ['whatsapp', 'messenger', 'instagram', 'viber']
    if (!validChannels.includes(channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // Determine clinic ID: explicit > by instance name > by channel credentials > default
    let effectiveClinicId = clinicId

    if (!effectiveClinicId && instanceName) {
      // Look up clinic by WhatsApp instance name (legacy support)
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id')
        .eq('whatsapp_instance', instanceName)
        .single()

      if (clinic) {
        effectiveClinicId = clinic.id
      }
    }

    if (!effectiveClinicId) {
      effectiveClinicId = getDefaultClinicId()
    }

    // Normalize channel user ID based on channel type
    let normalizedUserId = userIdentifier
    let normalizedPhone: string | null = null

    if (channel === 'whatsapp' || channel === 'viber') {
      // For phone-based channels, normalize the phone number
      normalizedUserId = userIdentifier.replace(/\D/g, '')
      if (normalizedUserId.startsWith('0')) {
        normalizedUserId = '359' + normalizedUserId.slice(1)
      } else if (!normalizedUserId.startsWith('359') && normalizedUserId.length < 12) {
        normalizedUserId = '359' + normalizedUserId
      }
      normalizedPhone = normalizedUserId
    }
    // For Messenger/Instagram, channelUserId is the PSID (no normalization needed)

    // Use the new unified conversations table with DB function
    const { data: conversationId, error: rpcError } = await supabase.rpc('get_or_create_conversation', {
      p_clinic_id: effectiveClinicId,
      p_channel: channel,
      p_channel_user_id: normalizedUserId,
      p_patient_phone: normalizedPhone,
      p_patient_name: patientName || null
    })

    if (rpcError || !conversationId) {
      console.error('Conversation RPC error:', rpcError)

      // Fallback: manual insert/select
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('clinic_id', effectiveClinicId)
        .eq('channel', channel)
        .eq('channel_user_id', normalizedUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!conversation) {
        // Check if patient exists (for phone-based channels)
        let patientId = null
        if (normalizedPhone) {
          const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('phone', normalizedPhone)
            .eq('clinic_id', effectiveClinicId)
            .single()
          patientId = patient?.id || null
        }

        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            clinic_id: effectiveClinicId,
            channel,
            channel_user_id: normalizedUserId,
            patient_id: patientId,
            patient_phone: normalizedPhone,
            patient_name: patientName || null,
            status: 'active'
          })
          .select('id')
          .single()

        if (convError) {
          console.error('Conversation creation error:', convError)
          throw convError
        }
        conversation = newConversation
      }

      // Insert message into unified messages table
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          direction,
          message_type: messageType || 'text',
          content,
          parsed_intent: parsedIntent || null,
          channel_message_id: messageId || null,
          raw_payload: rawPayload || null,
          status: direction === 'outbound' ? 'sent' : 'delivered'
        })
        .select('id, sent_at')
        .single()

      if (msgError) {
        console.error('Message insert error:', msgError)
        throw msgError
      }

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id)

      return NextResponse.json({
        success: true,
        channel,
        conversationId: conversation.id,
        messageId: message.id,
        timestamp: message.sent_at
      })
    }

    // Insert message using conversation from RPC
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        direction,
        message_type: messageType || 'text',
        content,
        parsed_intent: parsedIntent || null,
        channel_message_id: messageId || null,
        raw_payload: rawPayload || null,
        status: direction === 'outbound' ? 'sent' : 'delivered'
      })
      .select('id, sent_at')
      .single()

    if (msgError) {
      console.error('Message insert error:', msgError)
      throw msgError
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({
      success: true,
      channel,
      conversationId,
      messageId: message.id,
      timestamp: message.sent_at
    })

  } catch (error) {
    console.error('Log conversation error:', error)

    // Try legacy WhatsApp tables as fallback
    try {
      const supabase = createServerSupabaseClient()

      let body
      try {
        body = await request.clone().json()
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      const { instanceName, patientPhone, channelUserId, direction, content, messageType, messageId, rawPayload } = body
      const phone = channelUserId || patientPhone

      if (!phone || !content || !direction) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // Normalize phone
      let normalizedPhone = String(phone).replace(/\D/g, '')
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '359' + normalizedPhone.slice(1)
      } else if (!normalizedPhone.startsWith('359') && normalizedPhone.length < 12) {
        normalizedPhone = '359' + normalizedPhone
      }

      // Get or create legacy conversation
      let { data: conversation } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('patient_phone', normalizedPhone)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (!conversation) {
        const { data: newConv, error: convError } = await supabase
          .from('whatsapp_conversations')
          .insert({
            patient_phone: normalizedPhone,
            status: 'active'
          })
          .select('id')
          .single()

        if (convError) {
          console.error('Legacy conversation error:', convError)
          return NextResponse.json({
            error: 'Грешка на сървъра',
            details: convError.message,
            code: convError.code
          }, { status: 500 })
        }
        conversation = newConv
      }

      // Insert legacy message
      const { data: message, error: msgError } = await supabase
        .from('whatsapp_messages')
        .insert({
          conversation_id: conversation.id,
          direction,
          message_type: messageType || 'text',
          content,
          message_id: messageId || null,
          raw_payload: rawPayload || null
        })
        .select('id, sent_at')
        .single()

      if (msgError) {
        console.error('Legacy message error:', msgError)
        return NextResponse.json({
          error: 'Грешка на сървъра',
          details: msgError.message,
          code: msgError.code
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        channel: 'whatsapp',
        conversationId: conversation.id,
        messageId: message.id,
        timestamp: message.sent_at,
        legacy: true
      })

    } catch (fallbackError) {
      console.error('Legacy fallback also failed:', fallbackError)
      return NextResponse.json({
        error: 'Грешка на сървъра',
        details: String(error),
        fallbackError: String(fallbackError)
      }, { status: 500 })
    }
  }
}
