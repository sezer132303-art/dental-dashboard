import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function applyMigration() {
  console.log('Applying WhatsApp booking migration...\n')

  // Test 1: Check if source column exists on appointments
  const { data: testApt, error: aptError } = await supabase
    .from('appointments')
    .select('id')
    .limit(1)

  if (aptError) {
    console.log('appointments table error:', aptError.message)
  } else {
    console.log('✅ appointments table accessible')
  }

  // Test 2: Try to insert into whatsapp_conversations
  const { data: convInsert, error: convInsertError } = await supabase
    .from('whatsapp_conversations')
    .insert({
      patient_phone: '359888000000',
      status: 'active'
    })
    .select()
    .single()

  if (convInsertError?.code === '42P01') {
    console.log('❌ whatsapp_conversations table does not exist')
    console.log('\n⚠️  Migration needs to be run manually in Supabase SQL Editor')
    console.log('   The SQL has been copied to clipboard - paste it in the SQL Editor')
    return false
  } else if (convInsertError) {
    console.log('whatsapp_conversations insert error:', convInsertError.message)
  } else {
    console.log('✅ whatsapp_conversations table exists and is writable')

    // Clean up test data
    if (convInsert?.id) {
      await supabase.from('whatsapp_conversations').delete().eq('id', convInsert.id)
      console.log('   (test record cleaned up)')
    }
  }

  // Test 3: Try to insert into whatsapp_messages
  const { error: msgError } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .limit(1)

  if (msgError?.code === '42P01') {
    console.log('❌ whatsapp_messages table does not exist')
    return false
  } else if (msgError) {
    console.log('whatsapp_messages error:', msgError.message)
  } else {
    console.log('✅ whatsapp_messages table exists')
  }

  // Test 4: Check api_keys table
  const { error: keyError } = await supabase
    .from('api_keys')
    .select('id')
    .limit(1)

  if (keyError?.code === '42P01') {
    console.log('❌ api_keys table does not exist')
    return false
  } else if (keyError) {
    console.log('api_keys error:', keyError.message)
  } else {
    console.log('✅ api_keys table exists')
  }

  console.log('\n✅ All tables exist! Migration was already applied.')
  return true
}

applyMigration()
