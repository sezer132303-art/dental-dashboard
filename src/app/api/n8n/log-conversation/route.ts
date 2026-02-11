import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey, getDefaultClinicId } from '@/lib/api-auth'

// POST /api/n8n/log-conversation
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
      instanceName,      // WhatsApp instance name from Evolution API
      patientPhone,
      direction,         // 'inbound' or 'outbound'
      content,
      messageType,       // 'text', 'image', etc.
      parsedIntent,
      rawPayload,
      messageId          // Evolution API message ID
    } = body

    if (!patientPhone || !content || !direction) {
      return NextResponse.json(
        { error: 'Липсват задължителни полета: patientPhone, content, direction' },
        { status: 400 }
      )
    }

    // Determine clinic ID: explicit > by instance name > default
    let effectiveClinicId = clinicId

    if (!effectiveClinicId && instanceName) {
      // Look up clinic by WhatsApp instance name
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

    // Normalize phone number
    let normalizedPhone = patientPhone.replace(/\D/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '359' + normalizedPhone.slice(1)
    } else if (!normalizedPhone.startsWith('359')) {
      normalizedPhone = '359' + normalizedPhone
    }

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('patient_phone', normalizedPhone)
      .eq('status', 'active')
      .eq('clinic_id', effectiveClinicId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!conversation) {
      // Check if patient exists
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('phone', normalizedPhone)
        .eq('clinic_id', effectiveClinicId)
        .single()

      const { data: newConversation, error: convError } = await supabase
        .from('whatsapp_conversations')
        .insert({
          clinic_id: effectiveClinicId,
          patient_phone: normalizedPhone,
          patient_id: patient?.id || null,
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

    // Insert message
    const { data: message, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        direction,
        message_type: messageType || 'text',
        content,
        parsed_intent: parsedIntent || null,
        raw_payload: rawPayload || null,
        message_id: messageId || null
      })
      .select('id, sent_at')
      .single()

    if (msgError) {
      console.error('Message insert error:', msgError)
      throw msgError
    }

    // Update conversation updated_at
    await supabase
      .from('whatsapp_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      messageId: message.id,
      timestamp: message.sent_at
    })

  } catch (error) {
    console.error('Log conversation error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}
