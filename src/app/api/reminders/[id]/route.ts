import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/reminders/[id] - Get single reminder
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: reminder, error } = await supabase
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
      .eq('id', id)
      .single()

    if (error || !reminder) {
      return NextResponse.json({ error: 'Напомнянето не е намерено' }, { status: 404 })
    }

    return NextResponse.json({ reminder })
  } catch (error) {
    console.error('Get reminder error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// PUT /api/reminders/[id] - Update reminder status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const { status, sent_at, error_message, message_id } = body

    const updateData: Record<string, unknown> = {}

    if (status) updateData.status = status
    if (sent_at) updateData.sent_at = sent_at
    if (error_message !== undefined) updateData.error_message = error_message
    if (message_id) updateData.message_id = message_id

    const { data: reminder, error } = await supabase
      .from('reminders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating reminder:', error)
      return NextResponse.json({ error: 'Грешка при обновяване' }, { status: 500 })
    }

    return NextResponse.json({ reminder })
  } catch (error) {
    console.error('Update reminder error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// DELETE /api/reminders/[id] - Delete reminder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting reminder:', error)
      return NextResponse.json({ error: 'Грешка при изтриване' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete reminder error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
