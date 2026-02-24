import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthorizedClinicId } from '@/lib/session-auth'

// GET /api/patients - List patients (requires authentication)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedClinicId = searchParams.get('clinicId')
    const search = searchParams.get('search')

    // Get authorized clinic(s) based on user session
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('patients')
      .select('*')
      .eq('is_active', true)
      .order('name')

    // Non-admin users MUST have a clinic_id filter
    // Admin users can optionally filter by clinic
    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    } else if (!isAdmin) {
      // This shouldn't happen due to getAuthorizedClinicId, but safety check
      return NextResponse.json({ error: 'Clinic access required' }, { status: 403 })
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data: rawPatients, error } = await query

    if (error) {
      console.error('Error fetching patients:', error)
      return NextResponse.json({ error: 'Грешка при зареждане на пациенти' }, { status: 500 })
    }

    // Deduplicate patients by phone number
    // Keep the most complete/recent record for each phone
    const patientsByPhone = new Map<string, typeof rawPatients[0]>()
    for (const patient of rawPatients || []) {
      const phone = patient.phone
      if (!phone) continue

      const existing = patientsByPhone.get(phone)
      if (!existing) {
        patientsByPhone.set(phone, patient)
      } else {
        // Prefer patient with a real name over generic names
        const existingHasName = existing.name && existing.name !== 'WhatsApp пациент' && existing.name !== phone
        const currentHasName = patient.name && patient.name !== 'WhatsApp пациент' && patient.name !== phone

        if (currentHasName && !existingHasName) {
          patientsByPhone.set(phone, patient)
        } else if (currentHasName === existingHasName) {
          // If both have names (or both don't), prefer the most recently updated
          const existingDate = new Date(existing.updated_at || existing.created_at)
          const currentDate = new Date(patient.updated_at || patient.created_at)
          if (currentDate > existingDate) {
            patientsByPhone.set(phone, patient)
          }
        }
      }
    }

    const patients = Array.from(patientsByPhone.values())
    // Re-sort by name after deduplication
    patients.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    return NextResponse.json({ patients })
  } catch (error) {
    console.error('Patients API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

// POST /api/patients - Create a new patient (requires authentication)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, date_of_birth, gender, notes, clinic_id: requestedClinicId } = body

    // Verify user is authorized and get their clinic
    const { clinicId, isAdmin, error: authError } = await getAuthorizedClinicId(requestedClinicId)

    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    // Determine which clinic to create the patient in
    const effectiveClinicId = isAdmin ? (requestedClinicId || clinicId) : clinicId

    if (!effectiveClinicId) {
      return NextResponse.json(
        { error: 'Clinic ID is required' },
        { status: 400 }
      )
    }

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Име и телефон са задължителни' },
        { status: 400 }
      )
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/[\s\-\+]/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '359' + normalizedPhone.slice(1)
    } else if (!normalizedPhone.startsWith('359')) {
      normalizedPhone = '359' + normalizedPhone
    }

    const supabase = createServerSupabaseClient()

    // Check if patient with this phone already exists in this clinic
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('clinic_id', effectiveClinicId)
      .limit(1)
      .single()

    if (existingPatient) {
      // Update existing patient instead of creating duplicate
      const { data: updatedPatient, error: updateError } = await supabase
        .from('patients')
        .update({
          name: name || existingPatient.name,
          email: email || existingPatient.email,
          date_of_birth: date_of_birth || existingPatient.date_of_birth,
          gender: gender || existingPatient.gender,
          notes: notes || existingPatient.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPatient.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating patient:', updateError)
        return NextResponse.json({ error: 'Грешка при обновяване на пациент' }, { status: 500 })
      }

      return NextResponse.json({ patient: updatedPatient, updated: true }, { status: 200 })
    }

    // Create new patient
    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        name,
        phone: normalizedPhone,
        email,
        date_of_birth,
        gender,
        notes,
        clinic_id: effectiveClinicId
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating patient:', error)
      return NextResponse.json({ error: 'Грешка при създаване на пациент' }, { status: 500 })
    }

    return NextResponse.json({ patient }, { status: 201 })
  } catch (error) {
    console.error('Create patient error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}
