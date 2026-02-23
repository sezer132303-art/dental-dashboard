import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

type MessagingChannel = 'whatsapp' | 'messenger' | 'instagram' | 'viber'

interface Conversation {
  id: string
  clinic_id: string
  channel: MessagingChannel
  channel_user_id: string
  patient_phone: string | null
  patient_name: string | null
  patient_id: string | null
  status: string
  last_message_at: string
  created_at: string
  metadata: Record<string, unknown>
}

interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content: string
  message_type: string
  parsed_intent: string | null
  sent_at: string
}

interface Patient {
  id: string
  name: string
  phone: string
}

// GET /api/conversations - List conversations from all channels
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const requestedClinicId = searchParams.get('clinicId')
    const status = searchParams.get('status')
    const channel = searchParams.get('channel') as MessagingChannel | null

    // Check authentication and get authorized clinic
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    if (!isAdmin && !clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()

    // Build conversation query
    let query = supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(limit)

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (channel) {
      query = query.eq('channel', channel)
    }

    const { data: conversations, error: convError } = await query

    if (convError) {
      console.error('Conversations error:', convError)
      if (convError.code === '42P01') {
        return await getLegacyConversations(request)
      }
      throw convError
    }

    // If new table is empty, try legacy table (migration might not have run yet)
    if (!conversations || conversations.length === 0) {
      const legacyResult = await getLegacyConversations(request)
      const legacyData = await legacyResult.json()

      // If legacy has data, return it
      if (legacyData.conversations && legacyData.conversations.length > 0) {
        return NextResponse.json(legacyData)
      }

      return NextResponse.json({ conversations: [], channelStats: [] })
    }

    // Get all conversation IDs
    const conversationIds = conversations.map((c: Conversation) => c.id)

    // OPTIMIZED: Fetch all messages for all conversations in ONE query
    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('sent_at', { ascending: true })

    // Group messages by conversation_id
    const messagesByConversation = new Map<string, Message[]>()
    for (const msg of (allMessages || []) as Message[]) {
      if (!messagesByConversation.has(msg.conversation_id)) {
        messagesByConversation.set(msg.conversation_id, [])
      }
      messagesByConversation.get(msg.conversation_id)!.push(msg)
    }

    // Collect all patient IDs and phones for batch lookup
    const patientIds = new Set<string>()
    const patientPhones = new Set<string>()

    for (const conv of conversations as Conversation[]) {
      if (conv.patient_id) {
        patientIds.add(conv.patient_id)
      }
      if (conv.patient_phone) {
        patientPhones.add(conv.patient_phone)
      }
    }

    // OPTIMIZED: Fetch all patients in ONE query
    const patientsById = new Map<string, Patient>()
    const patientsByPhone = new Map<string, Patient>()

    if (patientIds.size > 0) {
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, name, phone')
        .in('id', Array.from(patientIds))

      for (const p of (patientsData || []) as Patient[]) {
        patientsById.set(p.id, p)
        patientsByPhone.set(p.phone, p)
      }
    }

    // Also look up patients by phone (for conversations without patient_id)
    const phonesWithoutPatient = Array.from(patientPhones).filter(
      phone => !Array.from(patientsByPhone.values()).some(p => p.phone === phone)
    )

    if (phonesWithoutPatient.length > 0) {
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, name, phone')
        .in('phone', phonesWithoutPatient)

      for (const p of (patientsData || []) as Patient[]) {
        patientsById.set(p.id, p)
        patientsByPhone.set(p.phone, p)
      }
    }

    // Enrich conversations (no additional queries needed!)
    const enrichedConversations = (conversations as Conversation[]).map(conv => {
      const messages = messagesByConversation.get(conv.id) || []

      // Get patient from cache
      let patient: Patient | null = null
      if (conv.patient_id && patientsById.has(conv.patient_id)) {
        patient = patientsById.get(conv.patient_id)!
      } else if (conv.patient_phone && patientsByPhone.has(conv.patient_phone)) {
        patient = patientsByPhone.get(conv.patient_phone)!
      }

      // Format messages
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        direction: msg.direction,
        content: msg.content,
        message_type: msg.message_type,
        parsed_intent: msg.parsed_intent,
        sent_at: msg.sent_at
      }))

      // Get last human message
      const humanMessages = formattedMessages.filter(m => m.direction === 'inbound')
      const lastHumanMessage = humanMessages[humanMessages.length - 1]

      // Calculate updated_at from last message
      const lastMessage = formattedMessages[formattedMessages.length - 1]
      const updatedAt = lastMessage?.sent_at || conv.last_message_at || conv.created_at

      // Display name: patient name > stored name > phone > user id
      const displayName = patient?.name || conv.patient_name || conv.patient_phone || conv.channel_user_id

      return {
        id: conv.id,
        channel: conv.channel,
        channel_user_id: conv.channel_user_id,
        patient_phone: conv.patient_phone,
        patient_id: conv.patient_id,
        clinic_id: conv.clinic_id,
        status: conv.status,
        started_at: conv.created_at,
        updated_at: updatedAt,
        patient: patient || {
          id: null,
          name: displayName,
          phone: conv.patient_phone || conv.channel_user_id
        },
        messagesCount: formattedMessages.length,
        lastMessage: lastHumanMessage || lastMessage,
        recentMessages: formattedMessages.slice(-10).reverse()
      }
    })

    // Get channel statistics (optional, single query)
    const { data: channelStats } = await supabase
      .from('conversation_stats')
      .select('*')

    return NextResponse.json({
      conversations: enrichedConversations,
      channelStats: channelStats || []
    })

  } catch (error) {
    console.error('Conversations API error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}

// Legacy support for whatsapp_conversations table (also optimized)
async function getLegacyConversations(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const clinicId = searchParams.get('clinicId')
  const status = searchParams.get('status')

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

  const { data: conversations, error } = await query

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ conversations: [] })
    }
    throw error
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  // Get all conversation IDs
  const conversationIds = conversations.map((c: { id: string }) => c.id)

  // OPTIMIZED: Fetch all messages in ONE query
  const { data: allMessages } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('sent_at', { ascending: true })

  // Group messages by conversation_id
  const messagesByConversation = new Map<string, Message[]>()
  for (const msg of (allMessages || []) as Message[]) {
    if (!messagesByConversation.has(msg.conversation_id)) {
      messagesByConversation.set(msg.conversation_id, [])
    }
    messagesByConversation.get(msg.conversation_id)!.push(msg)
  }

  // Collect all patient IDs and phones
  const patientIds = new Set<string>()
  const patientPhones = new Set<string>()

  for (const conv of conversations) {
    if (conv.patient_id) patientIds.add(conv.patient_id)
    if (conv.patient_phone) patientPhones.add(conv.patient_phone)
  }

  // OPTIMIZED: Fetch all patients in ONE query
  const patientsById = new Map<string, Patient>()
  const patientsByPhone = new Map<string, Patient>()

  if (patientIds.size > 0) {
    const { data: patientsData } = await supabase
      .from('patients')
      .select('id, name, phone')
      .in('id', Array.from(patientIds))

    for (const p of (patientsData || []) as Patient[]) {
      patientsById.set(p.id, p)
      patientsByPhone.set(p.phone, p)
    }
  }

  const phonesWithoutPatient = Array.from(patientPhones).filter(
    phone => !Array.from(patientsByPhone.values()).some(p => p.phone === phone)
  )

  if (phonesWithoutPatient.length > 0) {
    const { data: patientsData } = await supabase
      .from('patients')
      .select('id, name, phone')
      .in('phone', phonesWithoutPatient)

    for (const p of (patientsData || []) as Patient[]) {
      patientsById.set(p.id, p)
      patientsByPhone.set(p.phone, p)
    }
  }

  // Enrich conversations
  const enrichedConversations = conversations.map((conv: {
    id: string
    patient_phone: string
    patient_id: string | null
    clinic_id: string
    status: string
    started_at: string
  }) => {
    const messages = messagesByConversation.get(conv.id) || []

    let patient: Patient | null = null
    if (conv.patient_id && patientsById.has(conv.patient_id)) {
      patient = patientsById.get(conv.patient_id)!
    } else if (conv.patient_phone && patientsByPhone.has(conv.patient_phone)) {
      patient = patientsByPhone.get(conv.patient_phone)!
    }

    const formattedMessages = messages.map((msg: Message) => ({
      id: msg.id,
      direction: msg.direction,
      content: msg.content,
      parsed_intent: msg.parsed_intent,
      sent_at: msg.sent_at
    }))

    const lastMessage = formattedMessages[formattedMessages.length - 1]

    return {
      id: conv.id,
      channel: 'whatsapp' as MessagingChannel,
      channel_user_id: conv.patient_phone,
      patient_phone: conv.patient_phone,
      patient_id: conv.patient_id,
      clinic_id: conv.clinic_id,
      status: conv.status,
      started_at: conv.started_at,
      updated_at: lastMessage?.sent_at || conv.started_at,
      patient: patient || {
        id: null,
        name: conv.patient_phone,
        phone: conv.patient_phone
      },
      messagesCount: formattedMessages.length,
      lastMessage,
      recentMessages: formattedMessages.slice(-10).reverse()
    }
  })

  return NextResponse.json({ conversations: enrichedConversations })
}

// POST /api/conversations - Actions on conversations
export async function POST(request: NextRequest) {
  try {
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { conversationId, action } = body

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    // Verify conversation belongs to user's clinic (unless admin)
    if (!isAdmin) {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('clinic_id')
        .eq('id', conversationId)
        .single()

      if (convError || !conv) {
        return NextResponse.json({ error: 'Разговорът не е намерен' }, { status: 404 })
      }

      if (conv.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Нямате достъп до този разговор' }, { status: 403 })
      }
    }

    if (action === 'resolve') {
      let { error } = await supabase
        .from('conversations')
        .update({
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      if (error?.code === '42P01') {
        const result = await supabase
          .from('whatsapp_conversations')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString()
          })
          .eq('id', conversationId)
        error = result.error
      }

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
      let { error } = await supabase
        .from('conversations')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      if (error?.code === '42P01') {
        const result = await supabase
          .from('whatsapp_conversations')
          .update({
            status: 'active',
            resolved_at: null
          })
          .eq('id', conversationId)
        error = result.error
      }

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
