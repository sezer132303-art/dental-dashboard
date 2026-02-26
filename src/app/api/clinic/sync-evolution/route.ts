import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

const DEFAULT_EVOLUTION_API_URL = 'https://evo.sdautomation.sbs'

// POST /api/clinic/sync-evolution - Sync WhatsApp messages for current clinic
export async function POST(request: NextRequest) {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()

    // Get clinic credentials
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, evolution_api_url, whatsapp_instance, whatsapp_api_key')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    if (!clinic.whatsapp_instance || !clinic.whatsapp_api_key) {
      return NextResponse.json({
        error: 'WhatsApp не е конфигуриран. Моля, настройте Evolution API в Настройки.',
      }, { status: 400 })
    }

    const evolutionApiUrl = clinic.evolution_api_url || DEFAULT_EVOLUTION_API_URL
    const evolutionInstance = clinic.whatsapp_instance
    const evolutionApiKey = clinic.whatsapp_api_key

    // Clear existing conversations for this clinic
    await supabase
      .from('whatsapp_conversations')
      .delete()
      .eq('clinic_id', clinicId)

    // Fetch chats from Evolution API
    const chatsResponse = await fetch(
      `${evolutionApiUrl}/chat/findChats/${evolutionInstance}`,
      {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    )

    if (!chatsResponse.ok) {
      const errorText = await chatsResponse.text()
      return NextResponse.json({
        error: `Evolution API грешка: ${chatsResponse.status}`,
        details: errorText.substring(0, 200)
      }, { status: 502 })
    }

    const chats = await chatsResponse.json()

    if (!Array.isArray(chats)) {
      return NextResponse.json({
        error: 'Невалиден отговор от Evolution API',
      }, { status: 502 })
    }

    let totalConversations = 0
    let totalMessages = 0
    let totalInbound = 0
    let totalOutbound = 0

    for (const chat of chats.slice(0, 50)) {
      try {
        const originalRemoteJid = chat.remoteJid || ''
        if (originalRemoteJid.includes('@g.us')) continue

        let phoneJid = originalRemoteJid
        if (originalRemoteJid.includes('@lid') && chat.lastMessage?.key?.remoteJidAlt) {
          phoneJid = chat.lastMessage.key.remoteJidAlt
        }

        const phone = phoneJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
        if (!phone || phone.length < 10) continue
        if (phone === '359888123456') continue

        // Check if conversation exists
        let { data: existingConv } = await supabase
          .from('whatsapp_conversations')
          .select('id')
          .eq('patient_phone', phone)
          .eq('clinic_id', clinicId)
          .limit(1)
          .single()

        let conversationId: string

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const { data: newConv, error: convError } = await supabase
            .from('whatsapp_conversations')
            .insert({
              patient_phone: phone,
              clinic_id: clinicId,
              status: 'active',
              started_at: chat.updatedAt || new Date().toISOString()
            })
            .select('id')
            .single()

          if (convError || !newConv) continue
          conversationId = newConv.id
        }

        totalConversations++

        // Fetch messages
        const messagesResponse = await fetch(
          `${evolutionApiUrl}/chat/findMessages/${evolutionInstance}`,
          {
            method: 'POST',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              where: {
                key: { remoteJid: originalRemoteJid }
              },
              limit: 100
            })
          }
        )

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json()
          const messages = messagesData.messages?.records || messagesData.records || messagesData.messages || messagesData || []

          if (Array.isArray(messages)) {
            for (const msg of messages) {
              const content = msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                '[Media]'

              if (!content || content === '[Media]') continue

              const direction = msg.key?.fromMe ? 'outbound' : 'inbound'
              const timestamp = msg.messageTimestamp
                ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
                : new Date().toISOString()

              const { error: msgError } = await supabase
                .from('whatsapp_messages')
                .insert({
                  conversation_id: conversationId,
                  direction,
                  content,
                  message_type: 'text',
                  message_id: msg.key?.id || null,
                  sent_at: timestamp
                })

              if (!msgError) {
                totalMessages++
                if (direction === 'inbound') totalInbound++
                else totalOutbound++
              }
            }
          }
        }
      } catch (chatError) {
        console.error('Error processing chat:', chatError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Синхронизирани ${totalConversations} разговора, ${totalMessages} съобщения (${totalInbound} входящи, ${totalOutbound} изходящи).`
    })

  } catch (error) {
    console.error('Clinic sync error:', error)
    return NextResponse.json({
      error: 'Грешка при синхронизация',
      details: String(error)
    }, { status: 500 })
  }
}
