import { NextResponse } from 'next/server'

const N8N_WEBHOOK_URL = 'https://mwqopo2p.rpcld.net/webhook/calendar-sync'

// POST /api/calendar/sync - Trigger Google Calendar sync via n8n webhook
export async function POST() {
  try {
    // Trigger the workflow execution via n8n webhook
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'GET'
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('n8n webhook error:', errorText)
      return NextResponse.json(
        { error: 'Грешка при синхронизация с Google Calendar' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Синхронизацията стартира'
    })

  } catch (error) {
    console.error('Calendar sync trigger error:', error)
    return NextResponse.json(
      { error: 'Грешка при синхронизация' },
      { status: 500 }
    )
  }
}
