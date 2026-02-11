import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

interface DoctorInput {
  id?: string
  name: string
  specialty: string
  calendar_id?: string
}

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
        doctors:doctors(id, name, specialty, calendar_id, is_active),
        patients:patients(count),
        appointments:appointments(count)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Fetch clinic error:', error)
      return NextResponse.json({ error: 'Клиниката не е намерена' }, { status: 404 })
    }

    // Get admin user for this clinic
    const { data: adminUser } = await supabase
      .from('users')
      .select('id, phone, name')
      .eq('clinic_id', id)
      .eq('role', 'clinic')
      .maybeSingle()

    return NextResponse.json({
      ...clinic,
      admin: adminUser || null
    })
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
      return NextResponse.json({ error: `Грешка при обновяване: ${error.message}` }, { status: 500 })
    }

    // Handle admin user updates
    let adminResult: { action: string; success: boolean; error?: string } | null = null

    if (body.admin_name || body.admin_password || body.admin_phone) {
      // Normalize phone for lookup
      let lookupPhone = body.admin_phone?.replace(/[\s\-\+]/g, '') || ''
      if (lookupPhone.startsWith('0')) {
        lookupPhone = '359' + lookupPhone.slice(1)
      } else if (lookupPhone && !lookupPhone.startsWith('359')) {
        lookupPhone = '359' + lookupPhone
      }

      // Find existing admin user by clinic_id
      const { data: adminUser } = await supabase
        .from('users')
        .select('id, phone')
        .eq('clinic_id', id)
        .eq('role', 'clinic')
        .maybeSingle()

      console.log('Admin lookup for clinic', id, '- Found:', adminUser ? 'Yes' : 'No')

      if (adminUser) {
        // Update existing admin
        const adminUpdate: Record<string, any> = {}

        if (body.admin_name?.trim()) {
          adminUpdate.name = body.admin_name.trim()
        }

        if (body.admin_password && body.admin_password.length >= 6) {
          adminUpdate.password_hash = await bcrypt.hash(body.admin_password, 10)
          console.log('Password will be updated for admin', adminUser.id)
        }

        if (Object.keys(adminUpdate).length > 0) {
          const { error: adminError } = await supabase
            .from('users')
            .update(adminUpdate)
            .eq('id', adminUser.id)

          if (adminError) {
            console.error('Update admin error:', adminError)
            adminResult = { action: 'update', success: false, error: adminError.message }
          } else {
            console.log('Admin updated successfully:', Object.keys(adminUpdate))
            adminResult = { action: 'update', success: true }
          }
        } else {
          adminResult = { action: 'update', success: true }
        }
      } else if (lookupPhone && body.admin_password && body.admin_name) {
        // Create new admin user if all required fields are provided
        console.log('Creating new admin with phone:', lookupPhone)

        // Check if phone already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('phone', lookupPhone)
          .maybeSingle()

        if (existingUser) {
          console.log('Phone already registered:', lookupPhone)
          adminResult = { action: 'create', success: false, error: 'Този телефон вече е регистриран' }
        } else if (body.admin_password.length >= 6) {
          const passwordHash = await bcrypt.hash(body.admin_password, 10)
          const { data: newAdmin, error: createError } = await supabase
            .from('users')
            .insert({
              phone: lookupPhone,
              name: body.admin_name.trim(),
              role: 'clinic',
              clinic_id: id,
              is_active: true,
              password_hash: passwordHash
            })
            .select()
            .single()

          if (createError) {
            console.error('Create admin error:', createError)
            adminResult = { action: 'create', success: false, error: createError.message }
          } else {
            console.log('New admin created:', newAdmin?.id)
            adminResult = { action: 'create', success: true }
          }
        } else {
          adminResult = { action: 'create', success: false, error: 'Паролата трябва да е поне 6 символа' }
        }
      }
    }

    // Handle multiple doctors if provided
    if (body.doctors && Array.isArray(body.doctors)) {
      const doctorsList: DoctorInput[] = body.doctors.filter((d: any) => d.name?.trim())

      if (doctorsList.length > 0) {
        // Get existing doctors for this clinic with their calendar_ids
        const { data: existingDoctors } = await supabase
          .from('doctors')
          .select('id, calendar_id')
          .eq('clinic_id', id)

        const existingDoctorsMap = new Map(
          existingDoctors?.map(d => [d.id, d.calendar_id]) || []
        )
        const existingIds = Array.from(existingDoctorsMap.keys())
        const submittedIds = doctorsList.filter(d => d.id).map(d => d.id!)

        // Doctors to delete (exist in DB but not in submitted list)
        const toDelete = existingIds.filter(docId => !submittedIds.includes(docId))
        if (toDelete.length > 0) {
          await supabase
            .from('doctors')
            .delete()
            .in('id', toDelete)
        }

        // Process each doctor
        for (const doctor of doctorsList) {
          if (doctor.id && existingIds.includes(doctor.id)) {
            // Update existing doctor
            // Preserve existing calendar_id if new one is empty
            const existingCalendarId = existingDoctorsMap.get(doctor.id)
            const newCalendarId = doctor.calendar_id?.trim()
            const calendarIdToSave = newCalendarId || existingCalendarId || null

            await supabase
              .from('doctors')
              .update({
                name: doctor.name.trim(),
                specialty: doctor.specialty || 'Зъболекар',
                calendar_id: calendarIdToSave
              })
              .eq('id', doctor.id)
          } else {
            // Create new doctor
            await supabase
              .from('doctors')
              .insert({
                clinic_id: id,
                name: doctor.name.trim(),
                specialty: doctor.specialty || 'Зъболекар',
                calendar_id: doctor.calendar_id?.trim() || null,
                is_active: true
              })
          }
        }
      }
    } else if (body.doctor_name) {
      // Backward compatibility: Handle single doctor update
      const { data: existingDoctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('clinic_id', id)
        .limit(1)
        .maybeSingle()

      if (existingDoctor) {
        await supabase
          .from('doctors')
          .update({
            name: body.doctor_name,
            specialty: body.doctor_specialty || 'Зъболекар'
          })
          .eq('id', existingDoctor.id)
      } else {
        await supabase
          .from('doctors')
          .insert({
            clinic_id: id,
            name: body.doctor_name,
            specialty: body.doctor_specialty || 'Зъболекар',
            is_active: true
          })
      }
    }

    // Fetch updated admin info
    const { data: updatedAdmin } = await supabase
      .from('users')
      .select('id, phone, name')
      .eq('clinic_id', id)
      .eq('role', 'clinic')
      .maybeSingle()

    return NextResponse.json({
      ...clinic,
      admin: updatedAdmin || null,
      adminResult
    })
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

    // Delete admin users associated with this clinic
    await supabase
      .from('users')
      .delete()
      .eq('clinic_id', id)
      .eq('role', 'clinic')

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
