import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: clinic, error } = await supabase
      .from('clinics')
      .select(`
        *,
        doctors:doctors(id, name, specialty, is_active),
        patients:patients(count),
        appointments:appointments(count)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Fetch clinic error:', error)
      return NextResponse.json({ error: 'Клиниката не е намерена' }, { status: 404 })
    }

    return NextResponse.json(clinic)
  } catch (error) {
    console.error('Clinic API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, whatsapp_instance } = body

    const supabase = createServerSupabaseClient()

    const { data: clinic, error } = await supabase
      .from('clinics')
      .update({ name, whatsapp_instance })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update clinic error:', error)
      return NextResponse.json({ error: 'Грешка при обновяване' }, { status: 500 })
    }

    return NextResponse.json(clinic)
  } catch (error) {
    console.error('Update clinic API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { error } = await supabase
      .from('clinics')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete clinic error:', error)
      return NextResponse.json({ error: 'Грешка при изтриване' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete clinic API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
