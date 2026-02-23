import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey, getDefaultClinicId } from '@/lib/api-auth'

// Validation helpers
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_REGEX = /^[\d\s\-+()]{7,20}$/

function validateDate(date: string): boolean {
  if (!DATE_REGEX.test(date)) return false
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

function validateTime(time: string): boolean {
  if (!TIME_REGEX.test(time)) return false
  const [hours, minutes] = time.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

// POST /api/n8n/book-appointment
export async function POST(request: NextRequest) {
  const validation = await validateApiKey(request)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const {
      clinicId,
      doctorId,
      patientPhone,
      patientName,
      appointmentDate,
      startTime,
      endTime,
      type,
      notes,
      conversationId
    } = body

    // Get clinic ID (throws if not configured)
    let effectiveClinicId: string
    try {
      effectiveClinicId = clinicId || getDefaultClinicId()
    } catch (error) {
      console.error('Clinic ID error:', error)
      return NextResponse.json(
        { error: 'Clinic ID не е конфигуриран' },
        { status: 500 }
      )
    }

    // Validate required fields
    if (!doctorId || !patientPhone || !appointmentDate || !startTime) {
      return NextResponse.json(
        { error: 'Липсват задължителни полета: doctorId, patientPhone, appointmentDate, startTime' },
        { status: 400 }
      )
    }

    // Validate UUID format for doctorId
    if (!UUID_REGEX.test(doctorId)) {
      return NextResponse.json(
        { error: 'Невалиден формат на doctorId (трябва да е UUID)' },
        { status: 400 }
      )
    }

    // Validate phone format
    if (!PHONE_REGEX.test(patientPhone)) {
      return NextResponse.json(
        { error: 'Невалиден формат на телефонен номер' },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    if (!validateDate(appointmentDate)) {
      return NextResponse.json(
        { error: 'Невалиден формат на дата (трябва да е YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // Validate time format (HH:MM)
    if (!validateTime(startTime)) {
      return NextResponse.json(
        { error: 'Невалиден формат на начален час (трябва да е HH:MM)' },
        { status: 400 }
      )
    }

    if (endTime && !validateTime(endTime)) {
      return NextResponse.json(
        { error: 'Невалиден формат на краен час (трябва да е HH:MM)' },
        { status: 400 }
      )
    }

    // Verify clinic exists
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id')
      .eq('id', effectiveClinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Клиниката не е намерена' },
        { status: 404 }
      )
    }

    // Verify doctor exists and belongs to clinic
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('id, name, is_active')
      .eq('id', doctorId)
      .eq('clinic_id', effectiveClinicId)
      .single()

    if (doctorError || !doctor) {
      return NextResponse.json(
        { error: 'Докторът не е намерен в тази клиника' },
        { status: 404 }
      )
    }

    if (!doctor.is_active) {
      return NextResponse.json(
        { error: 'Докторът не е активен' },
        { status: 400 }
      )
    }

    // Normalize phone number (remove non-digits, ensure 359 prefix)
    let normalizedPhone = patientPhone.replace(/\D/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '359' + normalizedPhone.slice(1)
    } else if (!normalizedPhone.startsWith('359')) {
      normalizedPhone = '359' + normalizedPhone
    }

    // Find or create patient
    let { data: patient } = await supabase
      .from('patients')
      .select('id, name')
      .eq('phone', normalizedPhone)
      .eq('clinic_id', effectiveClinicId)
      .single()

    if (!patient) {
      const { data: newPatient, error: createError } = await supabase
        .from('patients')
        .insert({
          clinic_id: effectiveClinicId,
          phone: normalizedPhone,
          name: patientName || 'WhatsApp пациент'
        })
        .select('id, name')
        .single()

      if (createError) {
        console.error('Patient creation error:', createError)
        return NextResponse.json(
          { error: 'Грешка при създаване на пациент' },
          { status: 500 }
        )
      }
      patient = newPatient
    }

    // Look up service duration from appointment_types table
    let durationMinutes = 30 // Default
    if (type) {
      const { data: appointmentType } = await supabase
        .from('appointment_types')
        .select('duration_minutes')
        .eq('clinic_id', effectiveClinicId)
        .ilike('name', `%${type}%`)
        .single()

      if (appointmentType?.duration_minutes) {
        durationMinutes = appointmentType.duration_minutes
      }
    }

    // Calculate end time based on service duration
    const calculatedEndTime = endTime || (() => {
      const [h, m] = startTime.split(':').map(Number)
      const totalMinutes = h * 60 + m + durationMinutes
      const endHours = Math.floor(totalMinutes / 60)
      const endMins = totalMinutes % 60
      return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
    })()

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', appointmentDate)
      .eq('clinic_id', effectiveClinicId)
      .neq('status', 'cancelled')
      .lt('start_time', calculatedEndTime)
      .gt('end_time', startTime)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: 'Този час вече не е свободен', conflict: true },
        { status: 409 }
      )
    }

    // Create appointment
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        clinic_id: effectiveClinicId,
        doctor_id: doctorId,
        patient_id: patient.id,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: calculatedEndTime,
        type: type || 'Преглед',
        notes: notes || 'Запазен през WhatsApp',
        status: 'scheduled',
        source: 'whatsapp'
      })
      .select(`
        *,
        doctor:doctors (id, name, specialty),
        patient:patients (id, name, phone)
      `)
      .single()

    if (apptError) {
      console.error('Appointment creation error:', apptError)
      return NextResponse.json(
        { error: 'Грешка при създаване на час' },
        { status: 500 }
      )
    }

    // Update conversation status if provided
    if (conversationId) {
      await supabase
        .from('whatsapp_conversations')
        .update({
          status: 'booking_complete',
          patient_id: patient.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', conversationId)
    }

    // Format date for response
    const formattedDate = new Date(appointment.appointment_date).toLocaleDateString('bg-BG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        date: appointment.appointment_date,
        formattedDate,
        startTime: appointment.start_time.substring(0, 5),
        endTime: appointment.end_time.substring(0, 5),
        doctorId: appointment.doctor_id,
        doctorName: appointment.doctor?.name,
        patientId: appointment.patient_id,
        patientName: appointment.patient?.name,
        patientPhone: normalizedPhone,
        type: appointment.type,
        source: 'whatsapp'
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Book appointment error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}
