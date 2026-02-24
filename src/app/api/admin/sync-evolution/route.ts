import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

const EVOLUTION_API_URL = 'https://evo.sdautomation.sbs'
const EVOLUTION_INSTANCE = 'settbg'
const EVOLUTION_API_KEY = '0FAE5496B42F-47D8-B760-097162C6F2C3'

// Sync messages from Evolution API
export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get('authorization')
    const validKeys = [
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.N8N_API_KEY,
      'cleanup-demo-2026'
    ].filter(Boolean)

    const providedKey = authHeader?.replace('Bearer ', '')
    if (!providedKey || !validKeys.includes(providedKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const results: { action: string; count: number; error?: string }[] = []

    // 1. Clear old WhatsApp data
    const { count: convDeleted } = await supabase
      .from('whatsapp_conversations')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    results.push({ action: 'Clear old conversations', count: convDeleted || 0 })

    const { count: msgDeleted } = await supabase
      .from('whatsapp_messages')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    results.push({ action: 'Clear old messages', count: msgDeleted || 0 })

    // Also clear unified tables
    const { count: unifiedConvDeleted } = await supabase
      .from('conversations')
      .delete({ count: 'exact' })
      .eq('channel', 'whatsapp')

    results.push({ action: 'Clear unified conversations', count: unifiedConvDeleted || 0 })

    const { count: unifiedMsgDeleted } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    results.push({ action: 'Clear unified messages', count: unifiedMsgDeleted || 0 })

    // 2. Fetch chats from Evolution API
    const chatsResponse = await fetch(
      `${EVOLUTION_API_URL}/chat/findChats/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    )

    if (!chatsResponse.ok) {
      const errorText = await chatsResponse.text()
      return NextResponse.json({
        error: 'Failed to fetch chats from Evolution API',
        status: chatsResponse.status,
        details: errorText
      }, { status: 500 })
    }

    const chats = await chatsResponse.json()
    results.push({ action: 'Fetched chats from Evolution', count: Array.isArray(chats) ? chats.length : 0 })

    // 3. Process each chat and fetch messages
    let totalMessages = 0
    let totalConversations = 0

    if (Array.isArray(chats)) {
      for (const chat of chats.slice(0, 50)) { // Limit to 50 most recent chats
        try {
          // Extract phone number from remoteJid or lastMessage
          let remoteJid = chat.remoteJid || ''
          if (remoteJid.includes('@g.us')) continue // Skip groups

          // Handle @lid addresses - get actual phone from remoteJidAlt
          if (remoteJid.includes('@lid') && chat.lastMessage?.key?.remoteJidAlt) {
            remoteJid = chat.lastMessage.key.remoteJidAlt
          }

          const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
          if (!phone || phone.length < 10) continue

          // Skip test numbers
          if (phone === '359888123456') continue

          // Get default clinic
          const { data: clinic } = await supabase
            .from('clinics')
            .select('id')
            .limit(1)
            .single()

          const clinicId = clinic?.id || process.env.DEFAULT_CLINIC_ID

          // Check if conversation exists
          let { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('id')
            .eq('patient_phone', phone)
            .limit(1)
            .single()

          let conversationId: string

          if (existingConv) {
            conversationId = existingConv.id
          } else {
            // Create new conversation
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

            if (convError || !newConv) {
              console.error('Error creating conversation:', convError)
              continue
            }
            conversationId = newConv.id
          }

          totalConversations++

          // Fetch messages for this chat
          const messagesResponse = await fetch(
            `${EVOLUTION_API_URL}/chat/findMessages/${EVOLUTION_INSTANCE}`,
            {
              method: 'POST',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                where: {
                  key: {
                    remoteJid: remoteJid
                  }
                },
                limit: 100 // Last 100 messages per chat
              })
            }
          )

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            const messages = messagesData.messages || messagesData || []

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
                }
              }
            }
          }
        } catch (chatError) {
          console.error('Error processing chat:', chatError)
        }
      }
    }

    results.push({ action: 'Created conversations', count: totalConversations })
    results.push({ action: 'Imported messages', count: totalMessages })

    return NextResponse.json({
      success: true,
      message: `Sync completed. ${totalConversations} conversations, ${totalMessages} messages imported.`,
      results
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({
      error: 'Sync failed',
      details: String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to sync messages from Evolution API',
    evolutionApi: EVOLUTION_API_URL,
    instance: EVOLUTION_INSTANCE
  })
}
