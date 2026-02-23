// =============================================
// USER & AUTHENTICATION TYPES
// =============================================

export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'clinic'

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
    'view:conversations',
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
  ],
  clinic: [
    'view:dashboard',
    'view:appointments',
    'view:patients',
    'view:conversations',
    'view:calendar',
    'view:reports'
  ]
} as const

export type Permission = typeof ROLE_PERMISSIONS[UserRole][number]

// =============================================
// CLINIC TYPES
// =============================================

export interface Clinic {
  id: string
  name: string
  whatsapp_instance: string | null
  whatsapp_api_key: string | null
  evolution_api_url: string | null
  created_at: string
}

// =============================================
// DOCTOR TYPES
// =============================================

export interface Doctor {
  id: string
  user_id: string | null
  clinic_id: string
  name: string
  specialty: string | null
  phone: string | null
  email: string | null
  bio: string | null
  avatar_url: string | null
  color: string
  calendar_id: string | null
  is_active: boolean
  working_hours: Record<string, { start: string; end: string }> | null
  created_at: string
  updated_at: string
}

// =============================================
// PATIENT TYPES
// =============================================

export interface Patient {
  id: string
  clinic_id: string
  name: string
  phone: string
  email: string | null
  date_of_birth: string | null
  gender: string | null
  address: string | null
  notes: string | null
  medical_history: string | null
  allergies: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// =============================================
// APPOINTMENT TYPES
// =============================================

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type AppointmentSource = 'manual' | 'google_calendar' | 'whatsapp' | 'messenger' | 'instagram' | 'viber'

export interface Appointment {
  id: string
  clinic_id: string
  doctor_id: string
  patient_id: string | null
  appointment_date: string  // DATE format: YYYY-MM-DD
  start_time: string        // TIME format: HH:MM
  end_time: string          // TIME format: HH:MM
  status: AppointmentStatus
  type: string | null
  notes: string | null
  price: number | null
  source: AppointmentSource
  google_event_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields (when selecting with relations)
  doctor?: Doctor
  patient?: Patient
}

export interface AppointmentType {
  id: string
  clinic_id: string
  name: string
  duration_minutes: number
  color: string
  price: number | null
  is_active: boolean
  created_at: string
}

// =============================================
// REMINDER TYPES
// =============================================

export type ReminderType = '24h' | '3h' | 'confirmation' | 'followup'
export type ReminderStatus = 'pending' | 'sent' | 'failed'

export interface Reminder {
  id: string
  appointment_id: string
  type: ReminderType
  status: ReminderStatus
  scheduled_for: string
  sent_at: string | null
  error_message: string | null
  message_id: string | null
  created_at: string
}

// =============================================
// CONVERSATION & MESSAGE TYPES
// =============================================

export type MessagingChannel = 'whatsapp' | 'messenger' | 'instagram' | 'viber'

export interface Conversation {
  id: string
  clinic_id: string
  channel: MessagingChannel
  channel_user_id: string
  patient_id: string | null
  patient_phone: string | null
  status: string
  last_message_at: string
  metadata: Record<string, unknown>
  created_at: string
  // Joined fields
  patient?: Patient
  messages?: Message[]
}

export interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content: string
  parsed_intent: string | null
  channel_message_id: string | null
  status: 'sent' | 'delivered' | 'read' | 'failed'
  sent_at: string
}

// =============================================
// AUTH TYPES
// =============================================

export interface AuthToken {
  id: string
  phone: string
  token: string
  expires_at: string
  used: boolean
  created_at: string
}

// =============================================
// DASHBOARD & ANALYTICS TYPES
// =============================================

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

// =============================================
// API TYPES
// =============================================

export interface ApiError {
  error: string
  details?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
