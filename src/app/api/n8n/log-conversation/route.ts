import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey, getDefaultClinicId } from '@/lib/api-auth'

type MessagingChannel = 'whatsapp' | 'messenger' | 'instagram' | 'viber'

// POST /api/n8n/log-conversation
// Supports multi-channel messaging: WhatsApp, Messenger, Instagram, Viber
export async function POST(request: NextRequest) {
  const validation = await validateApiKey(request)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

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
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}
