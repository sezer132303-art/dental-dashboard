import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

// GET /api/clinic/cleanup-duplicates - Check for duplicates
// POST /api/clinic/cleanup-duplicates - Remove duplicates
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

    // Get all appointments with google_event_id
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, google_event_id, appointment_date, start_time, created_at')
      .eq('clinic_id', clinicId)
      .not('google_event_id', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Find duplicates
    const eventIdMap = new Map<string, typeof appointments>()
    appointments?.forEach(apt => {
      if (apt.google_event_id) {
        const existing = eventIdMap.get(apt.google_event_id) || []
        existing.push(apt)
        eventIdMap.set(apt.google_event_id, existing)
      }
    })

    // Filter to only duplicates (more than 1 entry per google_event_id)
    const duplicates: { google_event_id: string; count: number; ids: string[] }[] = []
    let totalDuplicates = 0

    eventIdMap.forEach((apts, eventId) => {
      if (apts.length > 1) {
        duplicates.push({
          google_event_id: eventId,
          count: apts.length,
          ids: apts.map(a => a.id)
        })
        totalDuplicates += apts.length - 1 // Count extras to delete
      }
    })

    // Get total count
    const { count: totalCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

    return NextResponse.json({
      totalAppointments: totalCount || 0,
      uniqueGoogleEvents: eventIdMap.size,
      duplicateGroups: duplicates.length,
      totalDuplicatesToRemove: totalDuplicates,
      duplicates: duplicates.slice(0, 20) // Show first 20
    })

  } catch (error) {
    console.error('Cleanup check error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST() {
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

    // Get all appointments with google_event_id
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, google_event_id, appointment_date, start_time, created_at')
      .eq('clinic_id', clinicId)
      .not('google_event_id', 'is', null)
      .order('created_at', { ascending: true }) // Keep oldest

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Find duplicates - keep the first (oldest) one
    const seenEventIds = new Set<string>()
    const idsToDelete: string[] = []

    appointments?.forEach(apt => {
      if (apt.google_event_id) {
        if (seenEventIds.has(apt.google_event_id)) {
          // This is a duplicate - mark for deletion
          idsToDelete.push(apt.id)
        } else {
          // First occurrence - keep it
          seenEventIds.add(apt.google_event_id)
        }
      }
    })

    if (idsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Няма дублирани записи за изтриване',
        deleted: 0
      })
    }

    // Delete duplicates in batches of 100
    let deleted = 0
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100)
      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .in('id', batch)

      if (deleteError) {
        console.error('Delete batch error:', deleteError)
      } else {
        deleted += batch.length
      }
    }

    return NextResponse.json({
      success: true,
      message: `Изтрити ${deleted} дублирани записи`,
      deleted,
      totalProcessed: idsToDelete.length
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
