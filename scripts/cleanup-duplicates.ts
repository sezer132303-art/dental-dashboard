/**
 * Script to cleanup duplicate appointments
 * Run with: npx ts-node scripts/cleanup-duplicates.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log('Starting duplicate cleanup...')

  // Get all appointments with google_event_id (paginated to get all)
  let allAppointments: { id: string; google_event_id: string; clinic_id: string; created_at: string }[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data: batch, error: batchError } = await supabase
      .from('appointments')
      .select('id, google_event_id, clinic_id, created_at')
      .not('google_event_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (batchError) {
      console.error('Error fetching batch:', batchError)
      break
    }

    if (batch && batch.length > 0) {
      allAppointments = allAppointments.concat(batch)
      page++
      console.log(`Fetched ${allAppointments.length} appointments...`)
    }

    hasMore = batch && batch.length === pageSize
  }

  const appointments = allAppointments
  const count = appointments.length
  const error = null

  if (error) {
    console.error('Error fetching appointments:', error)
    return
  }

  console.log(`Total appointments with google_event_id: ${count}`)

  // Group by clinic_id + google_event_id
  const groups = new Map<string, typeof appointments>()

  appointments?.forEach(apt => {
    const key = `${apt.clinic_id}:${apt.google_event_id}`
    const existing = groups.get(key) || []
    existing.push(apt)
    groups.set(key, existing)
  })

  // Find duplicates (all but the first/oldest)
  const idsToDelete: string[] = []
  let duplicateGroups = 0

  groups.forEach((apts, key) => {
    if (apts.length > 1) {
      duplicateGroups++
      // Keep the first (oldest), delete the rest
      for (let i = 1; i < apts.length; i++) {
        idsToDelete.push(apts[i].id)
      }
    }
  })

  console.log(`Unique google_event_ids: ${groups.size}`)
  console.log(`Duplicate groups: ${duplicateGroups}`)
  console.log(`Appointments to delete: ${idsToDelete.length}`)

  if (idsToDelete.length === 0) {
    console.log('No duplicates to delete!')
    return
  }

  // Delete in batches of 500
  let deleted = 0
  const batchSize = 500

  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize)

    const { error: deleteError, count: deleteCount } = await supabase
      .from('appointments')
      .delete({ count: 'exact' })
      .in('id', batch)

    if (deleteError) {
      console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError)
    } else {
      deleted += deleteCount || batch.length
      console.log(`Deleted batch ${i / batchSize + 1}: ${deleteCount || batch.length} appointments (total: ${deleted})`)
    }
  }

  console.log(`\nCleanup complete! Deleted ${deleted} duplicate appointments.`)

  // Verify final count
  const { count: finalCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })

  console.log(`Final appointment count: ${finalCount}`)
}

main().catch(console.error)
