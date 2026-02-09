export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          phone: string
          name: string | null
          email: string | null
          role: string
          clinic_id: string | null
          password_hash: string | null
          created_at: string
          last_login_at: string | null
        }
        Insert: {
          id?: string
          phone: string
          name?: string | null
          email?: string | null
          role?: string
          clinic_id?: string | null
          password_hash?: string | null
          created_at?: string
          last_login_at?: string | null
        }
        Update: {
          id?: string
          phone?: string
          name?: string | null
          email?: string | null
          role?: string
          clinic_id?: string | null
          password_hash?: string | null
          created_at?: string
          last_login_at?: string | null
        }
      }
      clinics: {
        Row: {
          id: string
          name: string
          whatsapp_instance: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          whatsapp_instance?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          whatsapp_instance?: string | null
          created_at?: string
        }
      }
      clients: {
        Row: {
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
        Insert: {
          phone: string
          name?: string | null
          first_contact_at?: string
          last_contact_at?: string
          total_appointments?: number
          cancelled_appointments?: number
          completed_appointments?: number
          no_show_count?: number
          notes?: string | null
          clinic_id?: string | null
        }
        Update: {
          phone?: string
          name?: string | null
          first_contact_at?: string
          last_contact_at?: string
          total_appointments?: number
          cancelled_appointments?: number
          completed_appointments?: number
          no_show_count?: number
          notes?: string | null
          clinic_id?: string | null
        }
      }
      appointments: {
        Row: {
          id: string
          google_event_id: string
          client_phone: string
          client_name: string
          service: string
          service_duration: number
          doctor_name: string
          doctor_calendar_id: string
          appointment_datetime: string
          status: string
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
        Insert: {
          id?: string
          google_event_id: string
          client_phone: string
          client_name: string
          service: string
          service_duration: number
          doctor_name: string
          doctor_calendar_id: string
          appointment_datetime: string
          status?: string
          created_at?: string
          cancelled_at?: string | null
          completed_at?: string | null
          reminder_24h_sent?: boolean
          reminder_24h_sent_at?: string | null
          reminder_3h_sent?: boolean
          reminder_3h_sent_at?: string | null
          notes?: string | null
          clinic_id?: string | null
        }
        Update: {
          id?: string
          google_event_id?: string
          client_phone?: string
          client_name?: string
          service?: string
          service_duration?: number
          doctor_name?: string
          doctor_calendar_id?: string
          appointment_datetime?: string
          status?: string
          created_at?: string
          cancelled_at?: string | null
          completed_at?: string | null
          reminder_24h_sent?: boolean
          reminder_24h_sent_at?: string | null
          reminder_3h_sent?: boolean
          reminder_3h_sent_at?: string | null
          notes?: string | null
          clinic_id?: string | null
        }
      }
      auth_tokens: {
        Row: {
          id: string
          phone: string
          token: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          phone: string
          token: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          phone?: string
          token?: string
          expires_at?: string
          used?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
