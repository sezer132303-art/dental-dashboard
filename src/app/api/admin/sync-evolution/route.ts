import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// Default credentials (fallback for backward compatibility)
const DEFAULT_EVOLUTION_API_URL = 'https://evo.sdautomation.sbs'
const DEFAULT_EVOLUTION_INSTANCE = 'settbg'
const DEFAULT_EVOLUTION_API_KEY = '0FAE5496B42F-47D8-B760-097162C6F2C3'

interface ClinicCredentials {
  clinicId: string
  clinicName: string
  evolutionApiUrl: string
  evolutionInstance: string
  evolutionApiKey: string
}

// Sync messages from Evolution API for a specific clinic or all clinics
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

    const body = await request.json().catch(() => ({}))
    const requestedClinicId = body.clinicId as string | undefined
    const clearExisting = body.clearExisting !== false // Default to true

    const supabase = createServerSupabaseClient()
    const results: { action: string; count: number; error?: string }[] = []

    // Get clinic credentials
    let clinicCredentials: ClinicCredentials[] = []

    if (requestedClinicId) {
      // Sync specific clinic
      const { data: clinic, error } = await supabase
        .from('clinics')
        .select('id, name, evolution_api_url, whatsapp_instance, whatsapp_api_key')
        .eq('id', requestedClinicId)
        .single()

      if (error || !clinic) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
      }

      if (!clinic.whatsapp_instance || !clinic.whatsapp_api_key) {
        return NextResponse.json({
          error: 'Clinic has no WhatsApp credentials configured',
          details: 'Please configure Evolution API URL, Instance Name, and API Key in clinic settings'
        }, { status: 400 })
      }

      clinicCredentials.push({
        clinicId: clinic.id,
        clinicName: clinic.name,
        evolutionApiUrl: clinic.evolution_api_url || DEFAULT_EVOLUTION_API_URL,
        evolutionInstance: clinic.whatsapp_instance,
        evolutionApiKey: clinic.whatsapp_api_key
      })
    } else {
      // Sync all clinics with WhatsApp credentials, or use default
      const { data: clinics } = await supabase
        .from('clinics')
        .select('id, name, evolution_api_url, whatsapp_instance, whatsapp_api_key')
        .not('whatsapp_instance', 'is', null)

      if (clinics && clinics.length > 0) {
        clinicCredentials = clinics
          .filter(c => c.whatsapp_instance && c.whatsapp_api_key)
          .map(c => ({
            clinicId: c.id,
            clinicName: c.name,
            evolutionApiUrl: c.evolution_api_url || DEFAULT_EVOLUTION_API_URL,
            evolutionInstance: c.whatsapp_instance,
            evolutionApiKey: c.whatsapp_api_key
          }))
      }

      // Fallback to default credentials if no clinics configured
      if (clinicCredentials.length === 0) {
        const { data: defaultClinic } = await supabase
          .from('clinics')
          .select('id, name')
          .limit(1)
          .single()

        clinicCredentials.push({
          clinicId: defaultClinic?.id || 'default',
          clinicName: defaultClinic?.name || 'Default',
          evolutionApiUrl: DEFAULT_EVOLUTION_API_URL,
          evolutionInstance: DEFAULT_EVOLUTION_INSTANCE,
          evolutionApiKey: DEFAULT_EVOLUTION_API_KEY
        })
      }
    }

    results.push({ action: 'Clinics to sync', count: clinicCredentials.length })

    // Process each clinic
    let totalMessages = 0
    let totalConversations = 0
    let totalInbound = 0
    let totalOutbound = 0
    const conversationDetails: { clinicName: string; phone: string; inbound: number; outbound: number }[] = []

    for (const credentials of clinicCredentials) {
      const { clinicId, clinicName, evolutionApiUrl, evolutionInstance, evolutionApiKey } = credentials

      // Clear existing data for this clinic if requested
      if (clearExisting) {
        const { count: convDeleted } = await supabase
          .from('whatsapp_conversations')
          .delete({ count: 'exact' })
          .eq('clinic_id', clinicId)

        results.push({ action: `Clear conversations for ${clinicName}`, count: convDeleted || 0 })
      }

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
        results.push({
          action: `Fetch chats for ${clinicName}`,
          count: 0,
          error: `API error ${chatsResponse.status}: ${errorText.substring(0, 100)}`
        })
        continue
      }

      const chats = await chatsResponse.json()
      results.push({ action: `Fetched chats for ${clinicName}`, count: Array.isArray(chats) ? chats.length : 0 })

      if (!Array.isArray(chats)) continue

      // Process each chat
      for (const chat of chats.slice(0, 50)) { // Limit to 50 most recent chats
        try {
          const originalRemoteJid = chat.remoteJid || ''
          if (originalRemoteJid.includes('@g.us')) continue // Skip groups

          // For @lid addresses, get actual phone from remoteJidAlt
          let phoneJid = originalRemoteJid
          if (originalRemoteJid.includes('@lid') && chat.lastMessage?.key?.remoteJidAlt) {
            phoneJid = chat.lastMessage.key.remoteJidAlt
          }

          const phone = phoneJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
          if (!phone || phone.length < 10) continue

          // Skip test numbers
          if (phone === '359888123456') continue

          // Check if conversation exists for this clinic
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
            `${evolutionApiUrl}/chat/findMessages/${evolutionInstance}`,
            {
              method: 'POST',
              headers: {
                'apikey': evolutionApiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                where: {
                  key: {
                    remoteJid: originalRemoteJid
                  }
                },
                limit: 100
              })
            }
          )

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            const messages = messagesData.messages?.records || messagesData.records || messagesData.messages || messagesData || []

            let chatInbound = 0
            let chatOutbound = 0

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
                  if (direction === 'inbound') {
                    totalInbound++
                    chatInbound++
                  } else {
                    totalOutbound++
                    chatOutbound++
                  }
                }
              }
            }

            // Track per-conversation stats
            const existingDetail = conversationDetails.find(d => d.phone === phone && d.clinicName === clinicName)
            if (existingDetail) {
              existingDetail.inbound += chatInbound
              existingDetail.outbound += chatOutbound
            } else {
              conversationDetails.push({ clinicName, phone, inbound: chatInbound, outbound: chatOutbound })
            }
          }
        } catch (chatError) {
          console.error('Error processing chat:', chatError)
        }
      }
    }

    results.push({ action: 'Total conversations', count: totalConversations })
    results.push({ action: 'Total messages', count: totalMessages })
    results.push({ action: 'Inbound messages (from patients)', count: totalInbound })
    results.push({ action: 'Outbound messages (from bot)', count: totalOutbound })

    return NextResponse.json({
      success: true,
      message: `Sync completed. ${totalConversations} conversations, ${totalMessages} messages (${totalInbound} inbound, ${totalOutbound} outbound).`,
      results,
      conversationDetails
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
    usage: {
      syncAllClinics: 'POST without body',
      syncSpecificClinic: 'POST with { clinicId: "uuid" }',
      keepExistingData: 'POST with { clearExisting: false }'
    }
  })
}
