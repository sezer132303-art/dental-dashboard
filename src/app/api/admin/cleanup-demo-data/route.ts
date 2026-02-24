import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// Cleanup demo/seed data from the database
export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const results: { action: string; deleted: number; error?: string }[] = []

    // 1. Delete demo patients (fake phone numbers 359888100001-8)
    const { data: demoPatients } = await supabase
      .from('patients')
      .select('id')
      .like('phone', '359888100%')

    if (demoPatients && demoPatients.length > 0) {
      const patientIds = demoPatients.map(p => p.id)

      // Delete their appointments first
      const { count: aptCount } = await supabase
        .from('appointments')
        .delete({ count: 'exact' })
        .in('patient_id', patientIds)

      results.push({ action: 'Delete demo patient appointments', deleted: aptCount || 0 })

      // Delete the patients
      const { count: patCount } = await supabase
        .from('patients')
        .delete({ count: 'exact' })
        .like('phone', '359888100%')

      results.push({ action: 'Delete demo patients', deleted: patCount || 0 })
    } else {
      results.push({ action: 'Delete demo patients', deleted: 0, error: 'No demo patients found' })
    }

    // 2. Delete demo users (fake phone numbers)
    const { count: userCount } = await supabase
      .from('users')
      .delete({ count: 'exact' })
      .or('phone.like.+359888000%,phone.like.359888000%')

    results.push({ action: 'Delete demo users', deleted: userCount || 0 })

    // 3. Delete demo doctors (fake phones 0888 111 111, etc.)
    const { data: demoDoctors } = await supabase
      .from('doctors')
      .select('id')
      .like('phone', '0888 %')

    if (demoDoctors && demoDoctors.length > 0) {
      const doctorIds = demoDoctors.map(d => d.id)

      // Delete their appointments first
      const { count: docAptCount } = await supabase
        .from('appointments')
        .delete({ count: 'exact' })
        .in('doctor_id', doctorIds)

      results.push({ action: 'Delete demo doctor appointments', deleted: docAptCount || 0 })

      // Delete the doctors
      const { count: docCount } = await supabase
        .from('doctors')
        .delete({ count: 'exact' })
        .like('phone', '0888 %')

      results.push({ action: 'Delete demo doctors', deleted: docCount || 0 })
    } else {
      results.push({ action: 'Delete demo doctors', deleted: 0, error: 'No demo doctors found' })
    }

    // 4. Clean up orphaned appointments
    const { count: orphanCount } = await supabase
      .from('appointments')
      .delete({ count: 'exact' })
      .is('patient_id', null)

    results.push({ action: 'Delete orphaned appointments', deleted: orphanCount || 0 })

    // 5. Delete demo conversations
    const { count: convCount } = await supabase
      .from('whatsapp_conversations')
      .delete({ count: 'exact' })
      .like('patient_phone', '359888100%')

    results.push({ action: 'Delete demo conversations', deleted: convCount || 0 })

    // Calculate totals
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0)

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Total records deleted: ${totalDeleted}`,
      results
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({
      error: 'Cleanup failed',
      details: String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run cleanup',
    warning: 'This will permanently delete demo data'
  })
}
