import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

type MessagingChannel = 'whatsapp' | 'messenger' | 'instagram' | 'viber'

interface ChannelCredential {
  id: string
  channel: MessagingChannel
  is_active: boolean
  credentials: Record<string, string>
  webhook_url: string | null
  last_verified_at: string | null
  created_at: string
}

// GET /api/clinic/channels - List all configured channels
export async function GET() {
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

    const { data: channels, error } = await supabase
      .from('channel_credentials')
      .select('id, channel, is_active, webhook_url, last_verified_at, created_at')
      .eq('clinic_id', clinicId)
      .order('channel')

    if (error) {
      console.error('Channels fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
    }

    // Get conversation stats per channel
    const { data: stats } = await supabase
      .from('conversation_stats')
      .select('*')
      .eq('clinic_id', clinicId)

    const statsMap = new Map(
      (stats || []).map(s => [s.channel, s])
    )

    // Build response with all channels (configured or not)
    const allChannels: MessagingChannel[] = ['whatsapp', 'messenger', 'instagram', 'viber']
    const channelsMap = new Map(
      (channels || []).map(c => [c.channel, c])
    )

    const response = allChannels.map(channel => {
      const config = channelsMap.get(channel)
      const channelStats = statsMap.get(channel)

      return {
        channel,
        configured: !!config,
        is_active: config?.is_active || false,
        webhook_url: config?.webhook_url || null,
        last_verified_at: config?.last_verified_at || null,
        stats: channelStats ? {
          total_conversations: channelStats.total_conversations,
          active_conversations: channelStats.active_conversations,
          completed_bookings: channelStats.completed_bookings,
          conversations_this_week: channelStats.conversations_this_week,
          conversations_today: channelStats.conversations_today
        } : null
      }
    })

    return NextResponse.json({ channels: response })
  } catch (error) {
    console.error('Clinic channels error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/clinic/channels - Add or update channel credentials
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

    const body = await request.json()
    const { channel, credentials, is_active, webhook_secret } = body

    if (!channel || !['whatsapp', 'messenger', 'instagram', 'viber'].includes(channel)) {
      return NextResponse.json(
        { error: 'Invalid channel. Must be: whatsapp, messenger, instagram, or viber' },
        { status: 400 }
      )
    }

    // Validate credentials structure per channel
    const validationError = validateCredentials(channel, credentials)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Upsert channel credentials
    const { data, error } = await supabase
      .from('channel_credentials')
      .upsert({
        clinic_id: clinicId,
        channel,
        credentials: credentials || {},
        is_active: is_active ?? true,
        webhook_secret: webhook_secret || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'clinic_id,channel'
      })
      .select('id, channel, is_active, created_at')
      .single()

    if (error) {
      console.error('Channel upsert error:', error)
      return NextResponse.json({ error: 'Failed to save channel' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      channel: data
    })
  } catch (error) {
    console.error('Clinic channels POST error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/clinic/channels - Remove channel configuration
export async function DELETE(request: NextRequest) {
  try {
    const user = await getClinicUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel')

    if (!channel || !['whatsapp', 'messenger', 'instagram', 'viber'].includes(channel)) {
      return NextResponse.json(
        { error: 'Invalid channel parameter' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    const { error } = await supabase
      .from('channel_credentials')
      .delete()
      .eq('clinic_id', clinicId)
      .eq('channel', channel)

    if (error) {
      console.error('Channel delete error:', error)
      return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clinic channels DELETE error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

function validateCredentials(channel: string, credentials: Record<string, string> | undefined): string | null {
  if (!credentials) {
    return 'Credentials are required'
  }

  switch (channel) {
    case 'whatsapp':
      if (!credentials.instance_name && !credentials.api_key) {
        return 'WhatsApp requires instance_name or api_key'
      }
      break

    case 'messenger':
    case 'instagram':
      if (!credentials.page_id || !credentials.page_access_token) {
        return `${channel} requires page_id and page_access_token`
      }
      break

    case 'viber':
      if (!credentials.bot_token) {
        return 'Viber requires bot_token'
      }
      break
  }

  return null
}
