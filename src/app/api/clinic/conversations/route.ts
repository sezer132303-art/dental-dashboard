import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

interface ChatMessage {
  type: 'human' | 'ai' | 'tool'
  name?: string
  content: string
  tool_calls?: Array<{
    name: string
    args: Record<string, unknown>
  }>
}

interface ChatHistory {
  id: number
  session_id: string
  message: ChatMessage
  created_at: string
}

export async function GET() {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    // Get conversations from n8n_chat_histories
    const { data: sessions, error: sessionsError } = await supabase
      .from('n8n_chat_histories')
      .select('session_id, created_at')
      .order('created_at', { ascending: false })

    if (sessionsError) {
      if (sessionsError.code === '42P01') {
        return NextResponse.json({ conversations: [] })
      }
      throw sessionsError
    }

    // Group by session_id
    const sessionMap = new Map<string, { firstMessage: string; lastMessage: string }>()
    for (const row of sessions || []) {
      if (!sessionMap.has(row.session_id)) {
        sessionMap.set(row.session_id, {
          firstMessage: row.created_at,
          lastMessage: row.created_at
        })
      } else {
        const existing = sessionMap.get(row.session_id)!
        if (row.created_at > existing.lastMessage) {
          existing.lastMessage = row.created_at
        }
        if (row.created_at < existing.firstMessage) {
          existing.firstMessage = row.created_at
        }
      }
    }

    // Convert to array and sort
    const uniqueSessions = Array.from(sessionMap.entries())
      .map(([sessionId, times]) => ({
        sessionId,
        ...times
      }))
      .sort((a, b) => new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime())
      .slice(0, 50)

    // Get full conversation data
    const conversations = await Promise.all(
      uniqueSessions.map(async (session) => {
        const { data: messages } = await supabase
          .from('n8n_chat_histories')
          .select('*')
          .eq('session_id', session.sessionId)
          .order('created_at', { ascending: true })

        const chatMessages = (messages || []) as ChatHistory[]

        const parsedMessages = chatMessages.map((msg) => {
          const messageData = msg.message
          let direction: 'inbound' | 'outbound' = 'inbound'
          let content = ''
          let intent: string | null = null

          if (messageData.type === 'human') {
            direction = 'inbound'
            content = messageData.content || ''
          } else if (messageData.type === 'ai') {
            direction = 'outbound'
            content = messageData.content || ''
            if (messageData.tool_calls?.length) {
              const toolName = messageData.tool_calls[0].name
              if (toolName === 'vzemi' || toolName === 'ONER') {
                intent = 'booking_request'
              } else if (toolName === 'saveCRM') {
                intent = 'booking_complete'
              }
            }
          } else if (messageData.type === 'tool') {
            return null
          }

          if (!content || content.trim() === '') {
            return null
          }

          // Skip internal agent thoughts/tool calls
          if (content.includes('Calling ') && content.includes(' with input:')) {
            return null
          }
          if (content.startsWith('Tool ') && content.includes(' returned:')) {
            return null
          }
          // Skip JSON-like internal messages
          if (content.trim().startsWith('{') && content.includes('"query"')) {
            return null
          }

          return {
            id: msg.id.toString(),
            direction,
            content,
            parsed_intent: intent,
            sent_at: msg.created_at
          }
        }).filter(Boolean)

        // Get patient info
        let patient = null
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('phone', session.sessionId)
          .single()

        if (clientData) {
          patient = {
            id: clientData.id || session.sessionId,
            name: clientData.name || clientData.ime || 'Клиент',
            phone: clientData.phone
          }
        }

        const hasBooking = parsedMessages.some(m => m?.parsed_intent === 'booking_complete')
        const status = hasBooking ? 'booking_complete' : 'active'

        const humanMessages = parsedMessages.filter(m => m?.direction === 'inbound')
        const lastHumanMessage = humanMessages[humanMessages.length - 1]

        return {
          id: session.sessionId,
          patient_phone: session.sessionId,
          patient_id: patient?.id || null,
          status,
          started_at: session.firstMessage,
          updated_at: session.lastMessage,
          patient,
          messagesCount: parsedMessages.length,
          lastMessage: lastHumanMessage || parsedMessages[parsedMessages.length - 1],
          recentMessages: parsedMessages.slice(-10).reverse()
        }
      })
    )

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Clinic conversations error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
