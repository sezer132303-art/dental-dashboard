import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
  console.log('Checking database tables...\n')

  // Check appointments table for source column
  const { data: appointments, error: aptError } = await supabase
    .from('appointments')
    .select('id, source')
    .limit(1)

  if (aptError) {
    console.log('❌ appointments table:', aptError.message)
  } else {
    const hasSource = appointments?.[0]?.source !== undefined || !aptError
    console.log('✅ appointments table exists')
    console.log('   source column:', hasSource ? '✅ exists' : '❌ missing')
  }

  // Check whatsapp_conversations table
  const { data: convs, error: convError } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .limit(1)

  if (convError?.code === '42P01') {
    console.log('❌ whatsapp_conversations table: does not exist')
  } else if (convError) {
    console.log('⚠️ whatsapp_conversations:', convError.message)
  } else {
    console.log('✅ whatsapp_conversations table exists')
  }

  // Check whatsapp_messages table
  const { data: msgs, error: msgError } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .limit(1)

  if (msgError?.code === '42P01') {
    console.log('❌ whatsapp_messages table: does not exist')
  } else if (msgError) {
    console.log('⚠️ whatsapp_messages:', msgError.message)
  } else {
    console.log('✅ whatsapp_messages table exists')
  }

  // Check api_keys table
  const { data: keys, error: keyError } = await supabase
    .from('api_keys')
    .select('id')
    .limit(1)

  if (keyError?.code === '42P01') {
    console.log('❌ api_keys table: does not exist')
  } else if (keyError) {
    console.log('⚠️ api_keys:', keyError.message)
  } else {
    console.log('✅ api_keys table exists')
  }

  console.log('\n---')
  console.log('If tables are missing, run the SQL from:')
  console.log('supabase/migrations/008_whatsapp_booking.sql')
  console.log('via Supabase Dashboard → SQL Editor')
}

checkTables()
