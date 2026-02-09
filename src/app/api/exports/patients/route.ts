import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const clinicId = searchParams.get('clinicId')

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('patients')
      .select(`
        id,
        name,
        phone,
        email,
        date_of_birth,
        gender,
        address,
        notes,
        is_active,
        created_at
      `)
      .order('name')

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data: patients, error } = await query

    if (error) {
      console.error('Export error:', error)
      return NextResponse.json({ error: 'Грешка при експорт' }, { status: 500 })
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Име', 'Телефон', 'Имейл', 'Дата на раждане', 'Пол', 'Адрес', 'Активен', 'Регистриран']
      const rows = patients?.map(p => [
        p.name,
        p.phone,
        p.email || '',
        p.date_of_birth || '',
        translateGender(p.gender),
        p.address || '',
        p.is_active ? 'Да' : 'Не',
        p.created_at?.split('T')[0] || ''
      ]) || []

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="patients-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // JSON format
    return NextResponse.json(patients)
  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json({ error: 'Неочаквана грешка' }, { status: 500 })
  }
}

function translateGender(gender: string | null): string {
  if (!gender) return ''
  const translations: Record<string, string> = {
    male: 'Мъж',
    female: 'Жена',
    other: 'Друг'
  }
  return translations[gender] || gender
}
