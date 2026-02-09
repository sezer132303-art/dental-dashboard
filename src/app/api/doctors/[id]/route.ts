import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/doctors/[id] - Get single doctor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: doctor, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !doctor) {
      return NextResponse.json({ error: 'Лекарят не е намерен' }, { status: 404 })
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
    const supabase = createServerSupabaseClient()
    const body = await request.json()

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
    const supabase = createServerSupabaseClient()

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
