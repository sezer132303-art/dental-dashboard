import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getClinicUser } from '@/lib/clinic-auth'

// GET /api/clinic/patients/[id] - Get single patient
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

    const { data: patient, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ patient })
  } catch (error) {
    console.error('Get patient error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/clinic/patients/[id] - Update patient
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

    // Verify the patient belongs to this clinic
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (!existingPatient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Only allow updating specific fields
    const updateData: Record<string, string | null> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email || null
    if (body.notes !== undefined) updateData.notes = body.notes || null

    const { data: patient, error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) {
      console.error('Update patient error:', error)
      return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })
    }

    return NextResponse.json({ patient })
  } catch (error) {
    console.error('Update patient error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
