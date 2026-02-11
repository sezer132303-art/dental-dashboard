import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

interface WhatsAppConversation {
  id: string
  clinic_id: string
  patient_phone: string
  patient_id: string | null
  status: string
  started_at: string
  resolved_at: string | null
}

interface WhatsAppMessage {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content: string
  parsed_intent: string | null
  sent_at: string
}

// GET /api/conversations - List WhatsApp conversations
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const clinicId = searchParams.get('clinicId')
    const status = searchParams.get('status') // 'active', 'resolved', 'booking_complete'

    // Get conversations from whatsapp_conversations table
    let query = supabase
      .from('whatsapp_conversations')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: conversations, error: convError } = await query

    if (convError) {
      console.error('Conversations error:', convError)
      // If table doesn't exist, return empty
      if (convError.code === '42P01') {
        return NextResponse.json({ conversations: [] })
      }
      throw convError
    }

    // Get messages and patient info for each conversation
    const enrichedConversations = await Promise.all(
      (conversations || []).map(async (conv: WhatsAppConversation) => {
        // Get messages for this conversation
        const { data: messages } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('sent_at', { ascending: true })

        const chatMessages = (messages || []) as WhatsAppMessage[]

        // Get patient info if patient_id exists
        let patient = null
        if (conv.patient_id) {
          const { data: patientData } = await supabase
            .from('patients')
            .select('id, name, phone')
            .eq('id', conv.patient_id)
            .single()

          if (patientData) {
            patient = patientData
          }
        }

        // If no patient_id, try to find by phone
        if (!patient && conv.patient_phone) {
          const { data: patientData } = await supabase
            .from('patients')
            .select('id, name, phone')
            .eq('phone', conv.patient_phone)
            .maybeSingle()

          if (patientData) {
            patient = patientData
          }
        }

        // Format messages
        const formattedMessages = chatMessages.map(msg => ({
          id: msg.id,
          direction: msg.direction,
          content: msg.content,
          parsed_intent: msg.parsed_intent,
          sent_at: msg.sent_at
        }))

        // Get last human message
        const humanMessages = formattedMessages.filter(m => m.direction === 'inbound')
        const lastHumanMessage = humanMessages[humanMessages.length - 1]

        // Calculate updated_at from last message
        const lastMessage = formattedMessages[formattedMessages.length - 1]
        const updatedAt = lastMessage?.sent_at || conv.started_at

        return {
          id: conv.id,
          patient_phone: conv.patient_phone,
          patient_id: conv.patient_id,
          clinic_id: conv.clinic_id,
          status: conv.status,
          started_at: conv.started_at,
          resolved_at: conv.resolved_at,
          updated_at: updatedAt,
          patient: patient || {
            id: null,
            name: conv.patient_phone,
            phone: conv.patient_phone
          },
          messagesCount: formattedMessages.length,
          lastMessage: lastHumanMessage || lastMessage,
          recentMessages: formattedMessages.slice(-10).reverse()
        }
      })
    )

    return NextResponse.json({ conversations: enrichedConversations })

  } catch (error) {
    console.error('Conversations API error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}

// POST /api/conversations - Actions on conversations
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { conversationId, action } = body

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    if (action === 'resolve') {
      // Update conversation status to resolved
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      if (error) {
        console.error('Error resolving conversation:', error)
        return NextResponse.json({ error: 'Грешка при приключване на разговора' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Разговорът е маркиран като приключен'
      })
    }

    if (action === 'reopen') {
      // Reopen a resolved conversation
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({
          status: 'active',
          resolved_at: null
        })
        .eq('id', conversationId)

      if (error) {
        console.error('Error reopening conversation:', error)
        return NextResponse.json({ error: 'Грешка при отваряне на разговора' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Разговорът е отворен отново'
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error) {
    console.error('Conversation action error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}
