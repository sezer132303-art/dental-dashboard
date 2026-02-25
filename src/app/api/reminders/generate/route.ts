import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// POST /api/reminders/generate - Generate reminders for existing appointments
export async function POST(request: NextRequest) {
  try {
    // Require admin or clinic authorization
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    if (!isAdmin && !clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const supabase = createServerSupabaseClient()
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Get all future appointments that don't have reminders yet
    let query = supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        status
      `)
      .gte('appointment_date', today)
      .in('status', ['scheduled', 'confirmed'])

    // Filter by clinic if not admin
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data: appointments, error: appointmentsError } = await query

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError)
      return NextResponse.json({ error: 'Грешка при зареждане на часове' }, { status: 500 })
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({
        message: 'Няма бъдещи часове за генериране на напомняния',
        created: 0
      })
    }

    // Get existing reminders for these appointments
    const appointmentIds = appointments.map(a => a.id)
    const { data: existingReminders } = await supabase
      .from('reminders')
      .select('appointment_id, type')
      .in('appointment_id', appointmentIds)

    // Build a set of existing reminders for quick lookup
    const existingSet = new Set(
      (existingReminders || []).map(r => `${r.appointment_id}:${r.type}`)
    )

    // Create missing reminders
    const remindersToCreate: Array<{
      appointment_id: string
      type: string
      status: string
      scheduled_for: string
    }> = []

    for (const appointment of appointments) {
      const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.start_time}`)

      // 24h reminder
      const reminder24h = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000)
      if (reminder24h > now && !existingSet.has(`${appointment.id}:24h`)) {
        remindersToCreate.push({
          appointment_id: appointment.id,
          type: '24h',
          status: 'pending',
          scheduled_for: reminder24h.toISOString()
        })
      }

      // 3h reminder
      const reminder3h = new Date(appointmentDateTime.getTime() - 3 * 60 * 60 * 1000)
      if (reminder3h > now && !existingSet.has(`${appointment.id}:3h`)) {
        remindersToCreate.push({
          appointment_id: appointment.id,
          type: '3h',
          status: 'pending',
          scheduled_for: reminder3h.toISOString()
        })
      }
    }

    if (remindersToCreate.length === 0) {
      return NextResponse.json({
        message: 'Всички напомняния вече са създадени',
        created: 0
      })
    }

    // Insert reminders
    const { error: insertError } = await supabase
      .from('reminders')
      .insert(remindersToCreate)

    if (insertError) {
      console.error('Error creating reminders:', insertError)
      return NextResponse.json({ error: 'Грешка при създаване на напомняния' }, { status: 500 })
    }

    return NextResponse.json({
      message: `Създадени ${remindersToCreate.length} напомняния`,
      created: remindersToCreate.length,
      details: {
        appointments: appointments.length,
        reminders24h: remindersToCreate.filter(r => r.type === '24h').length,
        reminders3h: remindersToCreate.filter(r => r.type === '3h').length
      }
    })
  } catch (error) {
    console.error('Generate reminders error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
