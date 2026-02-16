import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// POST /api/admin/fix-user-clinic
// Fixes users without clinic_id by assigning them to the default clinic
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Get the default clinic
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name')
      .limit(1)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'No clinic found' }, { status: 404 })
    }

    // Get users without clinic_id
    const { data: usersWithoutClinic, error: fetchError } = await supabase
      .from('users')
      .select('id, email, phone, name, role, clinic_id')
      .is('clinic_id', null)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!usersWithoutClinic || usersWithoutClinic.length === 0) {
      return NextResponse.json({
        message: 'All users already have clinic_id assigned',
        fixed: 0,
        clinic: clinic.name
      })
    }

    // Update users without clinic_id
    const { error: updateError } = await supabase
      .from('users')
      .update({ clinic_id: clinic.id })
      .is('clinic_id', null)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `Fixed ${usersWithoutClinic.length} users`,
      fixed: usersWithoutClinic.length,
      clinic: clinic.name,
      users: usersWithoutClinic.map(u => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        name: u.name
      }))
    })

  } catch (error) {
    console.error('Fix user clinic error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// GET - check status
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, phone, name, role, clinic_id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const withClinic = users?.filter(u => u.clinic_id) || []
    const withoutClinic = users?.filter(u => !u.clinic_id) || []

    return NextResponse.json({
      total: users?.length || 0,
      withClinicId: withClinic.length,
      withoutClinicId: withoutClinic.length,
      usersWithoutClinic: withoutClinic.map(u => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        name: u.name,
        role: u.role
      }))
    })
  } catch (error) {
    console.error('Check users error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
