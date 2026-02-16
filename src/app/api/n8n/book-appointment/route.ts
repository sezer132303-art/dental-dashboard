import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey, getDefaultClinicId } from '@/lib/api-auth'

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

    const effectiveClinicId = clinicId || getDefaultClinicId()

    // Validate required fields
    if (!doctorId || !patientPhone || !appointmentDate || !startTime) {
      return NextResponse.json(
        { error: 'Липсват задължителни полета: doctorId, patientPhone, appointmentDate, startTime' },
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
