import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/appointments/[id] - Get single appointment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        *,
        doctor:doctors (id, name, specialty, color, phone, email),
        patient:patients (id, name, phone, email)
      `)
      .eq('id', id)
      .single()

    if (error || !appointment) {
      return NextResponse.json({ error: 'Часът не е намерен' }, { status: 404 })
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    console.error('Get appointment error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// PUT /api/appointments/[id] - Update appointment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const {
      doctor_id,
      patient_id,
      appointment_date,
      start_time,
      end_time,
      status,
      type,
      notes,
      price
    } = body

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update({
        doctor_id,
        patient_id,
        appointment_date,
        start_time,
        end_time,
        status,
        type,
        notes,
        price,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        doctor:doctors (id, name, specialty, color),
        patient:patients (id, name, phone)
      `)
      .single()

    if (error) {
      console.error('Error updating appointment:', error)
      return NextResponse.json({ error: 'Грешка при обновяване' }, { status: 500 })
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    console.error('Update appointment error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// DELETE /api/appointments/[id] - Cancel appointment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    // Cancel instead of delete
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      console.error('Error cancelling appointment:', error)
      return NextResponse.json({ error: 'Грешка при отказване' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel appointment error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
