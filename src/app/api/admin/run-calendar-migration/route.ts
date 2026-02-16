import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// Run the Google Calendar sync migration
export async function POST() {
  try {
    const supabase = createServerSupabaseClient()
    const results: { step: string; success: boolean; error?: string }[] = []

    // Step 1: Check if google_event_id column exists
    const { data: columns } = await supabase
      .from('appointments')
      .select('google_event_id')
      .limit(1)

    if (columns === null) {
      // Column doesn't exist, need to add it via raw SQL
      results.push({
        step: 'Check google_event_id column',
        success: false,
        error: 'Column may not exist - run SQL manually in Supabase'
      })
    } else {
      results.push({ step: 'Check google_event_id column', success: true })
    }

    // Step 2: Try to add the constraint by deleting duplicates first
    // First, find duplicates
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, clinic_id, google_event_id')
      .not('google_event_id', 'is', null)

    if (appointments) {
      // Group by clinic_id + google_event_id to find duplicates
      const seen = new Map<string, string>()
      const duplicateIds: string[] = []

      for (const apt of appointments) {
        const key = `${apt.clinic_id}_${apt.google_event_id}`
        if (seen.has(key)) {
          duplicateIds.push(apt.id)
        } else {
          seen.set(key, apt.id)
        }
      }

      if (duplicateIds.length > 0) {
        // Delete duplicates
        const { error: deleteError } = await supabase
          .from('appointments')
          .delete()
          .in('id', duplicateIds)

        if (deleteError) {
          results.push({
            step: 'Remove duplicates',
            success: false,
            error: deleteError.message
          })
        } else {
          results.push({
            step: 'Remove duplicates',
            success: true,
            error: `Removed ${duplicateIds.length} duplicates`
          })
        }
      } else {
        results.push({ step: 'Remove duplicates', success: true, error: 'No duplicates found' })
      }
    }

    // Step 3: Test upsert operation
    const testResult = await supabase
      .from('appointments')
      .select('id')
      .limit(1)

    results.push({
      step: 'Database connection test',
      success: !testResult.error,
      error: testResult.error?.message
    })

    return NextResponse.json({
      message: 'Migration check completed',
      results,
      instructions: `
To complete the migration, run this SQL in Supabase SQL Editor:

ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_clinic_google_event_unique;

ALTER TABLE appointments
ADD CONSTRAINT appointments_clinic_google_event_unique
UNIQUE (clinic_id, google_event_id);

CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id
ON appointments(google_event_id)
WHERE google_event_id IS NOT NULL;
      `
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to run migration check',
    sql: `
-- Run this in Supabase SQL Editor:

ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_clinic_google_event_unique;

ALTER TABLE appointments
ADD CONSTRAINT appointments_clinic_google_event_unique
UNIQUE (clinic_id, google_event_id);

CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id
ON appointments(google_event_id)
WHERE google_event_id IS NOT NULL;
    `
  })
}
