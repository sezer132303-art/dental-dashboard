import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// GET /api/doctors/[id] - Get single doctor
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

    // Fetch doctor
    const { data: doctor, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !doctor) {
      return NextResponse.json({ error: 'Лекарят не е намерен' }, { status: 404 })
    }

    // Verify clinic access for non-admin users
    if (!isAdmin && doctor.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Нямате достъп до този лекар' }, { status: 403 })
    }

    return NextResponse.json({ doctor })
  } catch (error) {
    console.error('Get doctor error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// PUT /api/doctors/[id] - Update doctor
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
    const body = await request.json()

    // First verify doctor exists and user has access
    const { data: existingDoctor, error: fetchError } = await supabase
      .from('doctors')
      .select('clinic_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingDoctor) {
      return NextResponse.json({ error: 'Лекарят не е намерен' }, { status: 404 })
    }

    // Verify clinic access for non-admin users
    if (!isAdmin && existingDoctor.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Нямате достъп до този лекар' }, { status: 403 })
    }

    const { name, specialty, phone, email, color, bio, is_active } = body

    const { data: doctor, error } = await supabase
      .from('doctors')
      .update({
        name,
        specialty,
        phone,
        email,
        color,
        bio,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating doctor:', error)
      return NextResponse.json({ error: 'Грешка при обновяване' }, { status: 500 })
    }

    return NextResponse.json({ doctor })
  } catch (error) {
    console.error('Update doctor error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// DELETE /api/doctors/[id] - Delete (deactivate) doctor
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

    // First verify doctor exists and user has access
    const { data: existingDoctor, error: fetchError } = await supabase
      .from('doctors')
      .select('clinic_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingDoctor) {
      return NextResponse.json({ error: 'Лекарят не е намерен' }, { status: 404 })
    }

    // Verify clinic access for non-admin users
    if (!isAdmin && existingDoctor.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Нямате достъп до този лекар' }, { status: 403 })
    }

    // Soft delete - just deactivate
    const { error } = await supabase
      .from('doctors')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting doctor:', error)
      return NextResponse.json({ error: 'Грешка при изтриване' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete doctor error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
