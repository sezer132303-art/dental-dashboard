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

    // Build update object with only provided fields
    const updateData: Record<string, any> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.address !== undefined) updateData.address = body.address
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.whatsapp_instance !== undefined) updateData.whatsapp_instance = body.whatsapp_instance
    if (body.whatsapp_api_key !== undefined) updateData.whatsapp_api_key = body.whatsapp_api_key
    if (body.evolution_api_url !== undefined) updateData.evolution_api_url = body.evolution_api_url
    if (body.google_calendar_id !== undefined) updateData.google_calendar_id = body.google_calendar_id
    if (body.google_calendars !== undefined) updateData.google_calendars = body.google_calendars
    if (body.google_service_account !== undefined) updateData.google_service_account = body.google_service_account

    const supabase = createServerSupabaseClient()

    const { data: clinic, error } = await supabase
      .from('clinics')
      .update(updateData)
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
