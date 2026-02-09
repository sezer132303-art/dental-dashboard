export type UserRole = 'admin' | 'doctor' | 'receptionist'

export interface User {
  id: string
  phone: string
  name: string | null
  email: string | null
  role: UserRole
  clinic_id: string | null
  created_at: string
  last_login_at: string | null
}

// Permissions by role
export const ROLE_PERMISSIONS = {
  admin: [
    'view:dashboard',
    'view:appointments',
    'create:appointments',
    'edit:appointments',
    'delete:appointments',
    'view:patients',
    'create:patients',
    'edit:patients',
    'delete:patients',
    'view:doctors',
    'create:doctors',
    'edit:doctors',
    'delete:doctors',
    'view:calendar',
    'view:settings',
    'edit:settings',
    'view:users',
    'create:users',
    'edit:users',
    'delete:users',
    'view:clinics',
    'create:clinics',
    'edit:clinics',
    'delete:clinics',
    'view:reports',
    'export:data'
  ],
  doctor: [
    'view:dashboard',
    'view:appointments',
    'edit:appointments',
    'view:patients',
    'view:calendar',
    'view:settings'
  ],
  receptionist: [
    'view:dashboard',
    'view:appointments',
    'create:appointments',
    'edit:appointments',
    'view:patients',
    'create:patients',
    'edit:patients',
    'view:doctors',
    'view:calendar'
  ]
} as const

export type Permission = typeof ROLE_PERMISSIONS[UserRole][number]

export interface Clinic {
  id: string
  name: string
  whatsapp_instance: string | null
  created_at: string
}

export interface Client {
  phone: string
  name: string | null
  first_contact_at: string
  last_contact_at: string
  total_appointments: number
  cancelled_appointments: number
  completed_appointments: number
  no_show_count: number
  notes: string | null
  clinic_id: string | null
}

export interface Appointment {
  id: string
  google_event_id: string
  client_phone: string
  client_name: string
  service: string
  service_duration: number
  doctor_name: string
  doctor_calendar_id: string
  appointment_datetime: string
  status: 'confirmed' | 'completed' | 'cancelled' | 'no-show'
  created_at: string
  cancelled_at: string | null
  completed_at: string | null
  reminder_24h_sent: boolean
  reminder_24h_sent_at: string | null
  reminder_3h_sent: boolean
  reminder_3h_sent_at: string | null
  notes: string | null
  clinic_id: string | null
}

export interface AuthToken {
  id: string
  phone: string
  token: string
  expires_at: string
  used: boolean
  created_at: string
}

// Dashboard metrics types
export interface DashboardMetrics {
  totalClients: number
  clientGrowthPercent: number
  totalAppointments: number
  appointmentGrowthPercent: number
  attendanceRate: number
  attendanceChangePercent: number
  noShows: number
  reminders24hSent: number
  reminders3hSent: number
  appointmentsThisWeek: number
}

export interface WeeklyData {
  weekStart: string
  newClients: number
  appointmentsBooked: number
  attendanceRate: number
}

export interface DoctorStats {
  doctorName: string
  totalAppointments: number
  completed: number
  noShows: number
  cancelled: number
  attendanceRate: number
}
