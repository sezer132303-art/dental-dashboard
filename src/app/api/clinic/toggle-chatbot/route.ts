import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

const N8N_API_URL = process.env.N8N_API_URL || 'https://mwqopo2p.rpcld.net'
const N8N_CLOUD_API_KEY = process.env.N8N_CLOUD_API_KEY || ''

export async function POST(request: Request) {
  try {
    const user = await getClinicUser()
    if (!user || !user.clinic_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled is required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Get the clinic's n8n workflow ID
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, n8n_chatbot_workflow_id, chatbot_enabled')
      .eq('id', user.clinic_id)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Клиниката не е намерена' }, { status: 404 })
    }

    if (!clinic.n8n_chatbot_workflow_id) {
      return NextResponse.json({
        error: 'Няма конфигуриран n8n workflow за тази клиника'
      }, { status: 400 })
    }

    if (!N8N_CLOUD_API_KEY) {
      return NextResponse.json({ error: 'N8N_CLOUD_API_KEY is not configured' }, { status: 500 })
    }

    // Call n8n API to activate or deactivate the workflow
    const n8nAction = enabled ? 'activate' : 'deactivate'
    const n8nResponse = await fetch(
      `${N8N_API_URL}/api/v1/workflows/${clinic.n8n_chatbot_workflow_id}/${n8nAction}`,
      {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': N8N_CLOUD_API_KEY
        }
      }
    )

    if (!n8nResponse.ok) {
      const n8nError = await n8nResponse.text()
      console.error(`n8n ${n8nAction} error:`, n8nError)
      return NextResponse.json({
        error: `Грешка при ${enabled ? 'активиране' : 'деактивиране'} на chatbot`
      }, { status: 502 })
    }

    // Update chatbot_enabled in database
    const { error: updateError } = await supabase
      .from('clinics')
      .update({ chatbot_enabled: enabled })
      .eq('id', user.clinic_id)

    if (updateError) {
      console.error('Update chatbot_enabled error:', updateError)
      const rollbackAction = enabled ? 'deactivate' : 'activate'
      await fetch(
        `${N8N_API_URL}/api/v1/workflows/${clinic.n8n_chatbot_workflow_id}/${rollbackAction}`,
        {
          method: 'POST',
          headers: { 'X-N8N-API-KEY': N8N_CLOUD_API_KEY }
        }
      ).catch(() => {})
      return NextResponse.json({ error: 'Грешка при обновяване' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      chatbot_enabled: enabled,
      action: n8nAction
    })
  } catch (error) {
    console.error('Toggle chatbot API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
