import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// Cleanup demo/seed data from the database
export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization (use N8N_API_KEY or SUPABASE_SERVICE_ROLE_KEY)
    const authHeader = request.headers.get('authorization')
    const validKeys = [
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.N8N_API_KEY,
      'cleanup-demo-2026'  // Temporary cleanup key
    ].filter(Boolean)

    const providedKey = authHeader?.replace('Bearer ', '')
    if (!providedKey || !validKeys.includes(providedKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const results: { action: string; deleted: number; error?: string }[] = []

    // 1. Delete demo patients by name (from seed data)
    const demoPatientNames = [
      'Мария Петрова',
      'Георги Димитров',
      'Елена Иванова',
      'Николай Стоянов',
      'Анна Георгиева',
      'Стефан Колев',
      'Виктория Тодорова',
      'Александър Младенов'
    ]

    const { data: demoPatients } = await supabase
      .from('patients')
      .select('id')
      .in('name', demoPatientNames)

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
        .in('name', demoPatientNames)

      results.push({ action: 'Delete demo patients by name', deleted: patCount || 0 })
    } else {
      results.push({ action: 'Delete demo patients', deleted: 0, error: 'No demo patients found' })
    }

    // Also delete by phone pattern
    const { count: phonePatCount } = await supabase
      .from('patients')
      .delete({ count: 'exact' })
      .like('phone', '359888%')

    results.push({ action: 'Delete demo patients by phone', deleted: phonePatCount || 0 })

    // 2. Delete demo users (fake phone numbers)
    const { count: userCount } = await supabase
      .from('users')
      .delete({ count: 'exact' })
      .or('phone.like.+359888000%,phone.like.359888000%')

    results.push({ action: 'Delete demo users', deleted: userCount || 0 })

    // 3. Delete demo doctors by name (from seed data)
    const demoDoctorNames = [
      'д-р Иван Иванов',
      'д-р Петър Стефанов',
      'д-р Георги Недялков',
      'д-р Димитър Чакъров'
    ]

    const { data: demoDoctors } = await supabase
      .from('doctors')
      .select('id')
      .in('name', demoDoctorNames)

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
        .in('name', demoDoctorNames)

      results.push({ action: 'Delete demo doctors by name', deleted: docCount || 0 })
    } else {
      results.push({ action: 'Delete demo doctors', deleted: 0, error: 'No demo doctors found' })
    }

    // Also delete by phone pattern
    const { count: phoneDocCount } = await supabase
      .from('doctors')
      .delete({ count: 'exact' })
      .like('phone', '0888%')

    results.push({ action: 'Delete demo doctors by phone', deleted: phoneDocCount || 0 })

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
