import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

// GET /api/clinic/appointments/[id] - Get single appointment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        *,
        doctor:doctors (id, name, color),
        patient:patients (id, name, phone)
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    console.error('Get appointment error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/clinic/appointments/[id] - Update appointment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getClinicUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = user.clinic_id
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const supabase = createServerSupabaseClient()

    // Verify the appointment belongs to this clinic
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (!existingAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Only allow updating specific fields
    const updateData: Record<string, string | null> = {}

    // Status update with validation
    const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']
    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = body.status
    }

    if (body.notes !== undefined) updateData.notes = body.notes || null
    if (body.type !== undefined) updateData.type = body.type || null

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select(`
        *,
        doctor:doctors (id, name, color),
        patient:patients (id, name, phone)
      `)
      .single()

    if (error) {
      console.error('Update appointment error:', error)
      return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 })
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    console.error('Update appointment error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
