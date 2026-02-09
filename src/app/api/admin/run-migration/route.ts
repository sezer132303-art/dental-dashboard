import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// This endpoint runs the WhatsApp migration
// Only use this once during deployment, then delete this file
export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const results: { statement: string; success: boolean; error?: string }[] = []

    // 1. Add source column to appointments
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';`
      })
      results.push({ statement: 'Add source column', success: !error, error: error?.message })
    } catch (e: unknown) {
      // Column might already exist
      results.push({ statement: 'Add source column', success: true, error: 'Already exists or skipped' })
    }

    // 2. Create whatsapp_conversations table via insert test
    const { error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .limit(1)

    if (convError?.code === '42P01') {
      // Table doesn't exist - it needs to be created via SQL Editor
      results.push({
        statement: 'Create whatsapp_conversations',
        success: false,
        error: 'Table needs to be created via Supabase SQL Editor'
      })
    } else {
      results.push({ statement: 'Check whatsapp_conversations', success: true })
    }

    // 3. Create whatsapp_messages table via insert test
    const { error: msgError } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .limit(1)

    if (msgError?.code === '42P01') {
      results.push({
        statement: 'Create whatsapp_messages',
        success: false,
        error: 'Table needs to be created via Supabase SQL Editor'
      })
    } else {
      results.push({ statement: 'Check whatsapp_messages', success: true })
    }

    return NextResponse.json({
      message: 'Migration check completed',
      results,
      instructions: 'If tables do not exist, run the SQL in supabase/migrations/008_whatsapp_booking.sql via Supabase Dashboard SQL Editor'
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
