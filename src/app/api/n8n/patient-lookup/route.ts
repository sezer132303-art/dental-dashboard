import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateApiKey, getDefaultClinicId } from '@/lib/api-auth'

// GET /api/n8n/patient-lookup?phone=359888123456&clinicId=xxx
// Returns patient info and appointment history for the WhatsApp chatbot
export async function GET(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const phone = searchParams.get('phone')
    const clinicId = searchParams.get('clinicId') || getDefaultClinicId()

    if (!phone) {
      return NextResponse.json(
        { error: 'Missing required parameter: phone' },
        { status: 400 }
      )
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '359' + normalizedPhone.slice(1)
    } else if (!normalizedPhone.startsWith('359')) {
      normalizedPhone = '359' + normalizedPhone
    }

    // Look up patient by phone
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, phone, email, notes, created_at')
      .eq('phone', normalizedPhone)
      .eq('clinic_id', clinicId)
      .single()

    if (patientError || !patient) {
      // Patient not found - this is a new patient
      return NextResponse.json({
        found: false,
        isNewPatient: true,
        phone: normalizedPhone,
        message: 'Пациентът не е намерен в системата'
      })
    }

    // Get appointment history
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        status,
        type,
        notes,
        doctor:doctors (id, name, specialty)
      `)
      .eq('patient_id', patient.id)
      .eq('clinic_id', clinicId)
      .order('appointment_date', { ascending: false })
      .limit(10)

    if (apptError) {
      console.error('Error fetching appointments:', apptError)
    }

    // Calculate statistics
    const totalAppointments = appointments?.length || 0
    const completedAppointments = appointments?.filter(a => a.status === 'completed').length || 0
    const cancelledAppointments = appointments?.filter(a => a.status === 'cancelled').length || 0
    const noShowAppointments = appointments?.filter(a => a.status === 'no_show').length || 0
    const upcomingAppointments = appointments?.filter(a =>
      a.status === 'scheduled' || a.status === 'confirmed'
    ) || []

    // Get last completed appointment
    const lastCompletedAppointment = appointments?.find(a => a.status === 'completed')

    // Get most visited doctor
    type DoctorInfo = { id: string; name: string; specialty: string }
    const doctorVisits: Record<string, { name: string; count: number }> = {}
    appointments?.forEach(apt => {
      if (apt.status === 'completed' && apt.doctor) {
        const doctor = apt.doctor as unknown as DoctorInfo
        if (!doctorVisits[doctor.id]) {
          doctorVisits[doctor.id] = { name: doctor.name, count: 0 }
        }
        doctorVisits[doctor.id].count++
      }
    })
    const preferredDoctor = Object.entries(doctorVisits)
      .sort((a, b) => b[1].count - a[1].count)[0]

    // Format response for AI chatbot
    return NextResponse.json({
      found: true,
      isNewPatient: false,
      patient: {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
        memberSince: patient.created_at
      },
      stats: {
        totalVisits: completedAppointments,
        totalAppointments,
        cancelledAppointments,
        noShowAppointments,
        upcomingCount: upcomingAppointments.length
      },
      lastVisit: lastCompletedAppointment ? {
        date: lastCompletedAppointment.appointment_date,
        type: lastCompletedAppointment.type,
        doctor: (lastCompletedAppointment.doctor as unknown as DoctorInfo)?.name
      } : null,
      preferredDoctor: preferredDoctor ? {
        name: preferredDoctor[1].name,
        visitCount: preferredDoctor[1].count
      } : null,
      upcomingAppointments: upcomingAppointments.map(apt => ({
        date: apt.appointment_date,
        time: apt.start_time?.substring(0, 5),
        type: apt.type,
        doctor: (apt.doctor as unknown as DoctorInfo)?.name,
        status: apt.status
      })),
      recentAppointments: appointments?.slice(0, 5).map(apt => ({
        date: apt.appointment_date,
        time: apt.start_time?.substring(0, 5),
        type: apt.type,
        doctor: (apt.doctor as unknown as DoctorInfo)?.name,
        status: apt.status
      })) || [],
      // AI-friendly summary for the chatbot
      summary: generatePatientSummary(patient, completedAppointments, lastCompletedAppointment, preferredDoctor, upcomingAppointments)
    })

  } catch (error) {
    console.error('Patient lookup error:', error)
    return NextResponse.json({ error: 'Грешка на сървъра' }, { status: 500 })
  }
}

function generatePatientSummary(
  patient: { name: string },
  completedVisits: number,
  lastVisit: { appointment_date: string; type: string; doctor: unknown } | null | undefined,
  preferredDoctor: [string, { name: string; count: number }] | undefined,
  upcomingAppointments: Array<{ appointment_date: string; start_time: string; doctor: unknown }>
): string {
  const parts: string[] = []

  parts.push(`Пациент: ${patient.name}`)

  if (completedVisits > 0) {
    parts.push(`Общо посещения: ${completedVisits}`)
  }

  if (lastVisit) {
    const lastVisitDate = new Date(lastVisit.appointment_date).toLocaleDateString('bg-BG')
    const doctorName = (lastVisit.doctor as { name?: string } | null)?.name || 'неизвестен лекар'
    parts.push(`Последно посещение: ${lastVisitDate} - ${lastVisit.type} при ${doctorName}`)
  }

  if (preferredDoctor) {
    parts.push(`Предпочитан лекар: ${preferredDoctor[1].name} (${preferredDoctor[1].count} посещения)`)
  }

  if (upcomingAppointments.length > 0) {
    const nextApt = upcomingAppointments[0]
    const nextDate = new Date(nextApt.appointment_date).toLocaleDateString('bg-BG')
    parts.push(`Предстоящ час: ${nextDate} в ${nextApt.start_time?.substring(0, 5)}`)
  }

  return parts.join('. ')
}
