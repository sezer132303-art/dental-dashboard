import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// Update doctor colors to be distinct
const DOCTOR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
]

export async function POST() {
  try {
    const supabase = createServerSupabaseClient()

    // Get all doctors
    const { data: doctors, error: fetchError } = await supabase
      .from('doctors')
      .select('id, name, color')
      .order('name')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!doctors || doctors.length === 0) {
      return NextResponse.json({ message: 'No doctors found' })
    }

    // Update each doctor with a unique color
    const updates = []
    for (let i = 0; i < doctors.length; i++) {
      const color = DOCTOR_COLORS[i % DOCTOR_COLORS.length]
      const { error } = await supabase
        .from('doctors')
        .update({ color })
        .eq('id', doctors[i].id)

      updates.push({
        name: doctors[i].name,
        oldColor: doctors[i].color,
        newColor: color,
        success: !error
      })
    }

    return NextResponse.json({
      message: 'Doctor colors updated',
      updates
    })
  } catch (error) {
    console.error('Update doctor colors error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data: doctors } = await supabase
      .from('doctors')
      .select('id, name, color')
      .order('name')

    return NextResponse.json({
      doctors: doctors || [],
      availableColors: DOCTOR_COLORS
    })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
