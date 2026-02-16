import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// GET /api/patients/[id] - Get single patient with appointments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check authentication
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    const { data: patient, error } = await supabase
      .from('patients')
      .select(`
        *,
        appointments (
          id,
          appointment_date,
          start_time,
          end_time,
          status,
          type,
          doctor:doctors (id, name, specialty)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !patient) {
      return NextResponse.json({ error: 'Пациентът не е намерен' }, { status: 404 })
    }

    // Verify clinic access for non-admin users
    if (!isAdmin && patient.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Нямате достъп до този пациент' }, { status: 403 })
    }

    return NextResponse.json({ patient })
  } catch (error) {
    console.error('Get patient error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// PUT /api/patients/[id] - Update patient
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check authentication
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    // Verify patient exists and user has access
    const { data: existingPatient, error: fetchError } = await supabase
      .from('patients')
      .select('clinic_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingPatient) {
      return NextResponse.json({ error: 'Пациентът не е намерен' }, { status: 404 })
    }

    // Verify clinic access for non-admin users
    if (!isAdmin && existingPatient.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Нямате достъп до този пациент' }, { status: 403 })
    }

    const body = await request.json()
    const { name, phone, email, date_of_birth, gender, notes, is_active } = body

    // Normalize phone if provided
    let normalizedPhone = phone
    if (phone) {
      normalizedPhone = phone.replace(/[\s\-\+]/g, '')
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '359' + normalizedPhone.slice(1)
      } else if (!normalizedPhone.startsWith('359')) {
        normalizedPhone = '359' + normalizedPhone
      }
    }

    const { data: patient, error } = await supabase
      .from('patients')
      .update({
        name,
        phone: normalizedPhone,
        email,
        date_of_birth,
        gender,
        notes,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating patient:', error)
      return NextResponse.json({ error: 'Грешка при обновяване' }, { status: 500 })
    }

    return NextResponse.json({ patient })
  } catch (error) {
    console.error('Update patient error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// DELETE /api/patients/[id] - Delete (deactivate) patient
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check authentication
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId()

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    // Verify patient exists and user has access
    const { data: existingPatient, error: fetchError } = await supabase
      .from('patients')
      .select('clinic_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingPatient) {
      return NextResponse.json({ error: 'Пациентът не е намерен' }, { status: 404 })
    }

    // Verify clinic access for non-admin users
    if (!isAdmin && existingPatient.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Нямате достъп до този пациент' }, { status: 403 })
    }

    const { error } = await supabase
      .from('patients')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting patient:', error)
      return NextResponse.json({ error: 'Грешка при изтриване' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete patient error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
