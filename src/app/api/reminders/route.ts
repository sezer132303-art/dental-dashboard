import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/reminders - List reminders
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const appointmentId = searchParams.get('appointmentId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    let query = supabase
      .from('reminders')
      .select(`
        *,
        appointment:appointments (
          id,
          appointment_date,
          start_time,
          patient:patients (id, name, phone),
          doctor:doctors (id, name)
        )
      `)
      .order('created_at', { ascending: false })

    if (appointmentId) {
      query = query.eq('appointment_id', appointmentId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('type', type)
    }

    const { data: reminders, error } = await query

    if (error) {
      console.error('Error fetching reminders:', error)
      return NextResponse.json({ error: 'Грешка при зареждане' }, { status: 500 })
    }

    return NextResponse.json({ reminders })
  } catch (error) {
    console.error('Reminders API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// POST /api/reminders - Create a reminder (for manual scheduling)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const {
      appointment_id,
      type,
      scheduled_for
    } = body

    if (!appointment_id || !type || !scheduled_for) {
      return NextResponse.json(
        { error: 'Липсват задължителни полета' },
        { status: 400 }
      )
    }

    // Check if reminder already exists
    const { data: existing } = await supabase
      .from('reminders')
      .select('id')
      .eq('appointment_id', appointment_id)
      .eq('type', type)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Напомнянето вече съществува' },
        { status: 409 }
      )
    }

    const { data: reminder, error } = await supabase
      .from('reminders')
      .insert({
        appointment_id,
        type,
        scheduled_for,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating reminder:', error)
      return NextResponse.json({ error: 'Грешка при създаване' }, { status: 500 })
    }

    return NextResponse.json({ reminder }, { status: 201 })
  } catch (error) {
    console.error('Create reminder error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
