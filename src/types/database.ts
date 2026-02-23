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
          whatsapp_api_key: string | null
          evolution_api_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          whatsapp_instance?: string | null
          whatsapp_api_key?: string | null
          evolution_api_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          whatsapp_instance?: string | null
          whatsapp_api_key?: string | null
          evolution_api_url?: string | null
          created_at?: string
        }
      }
      doctors: {
        Row: {
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
          working_hours: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          clinic_id: string
          name: string
          specialty?: string | null
          phone?: string | null
          email?: string | null
          bio?: string | null
          avatar_url?: string | null
          color?: string
          calendar_id?: string | null
          is_active?: boolean
          working_hours?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          clinic_id?: string
          name?: string
          specialty?: string | null
          phone?: string | null
          email?: string | null
          bio?: string | null
          avatar_url?: string | null
          color?: string
          calendar_id?: string | null
          is_active?: boolean
          working_hours?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      patients: {
        Row: {
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
        Insert: {
          id?: string
          clinic_id: string
          name: string
          phone: string
          email?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: string | null
          notes?: string | null
          medical_history?: string | null
          allergies?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          phone?: string
          email?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: string | null
          notes?: string | null
          medical_history?: string | null
          allergies?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      appointments: {
        Row: {
          id: string
          clinic_id: string
          doctor_id: string
          patient_id: string | null
          appointment_date: string
          start_time: string
          end_time: string
          status: string
          type: string | null
          notes: string | null
          price: number | null
          source: string
          google_event_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          doctor_id: string
          patient_id?: string | null
          appointment_date: string
          start_time: string
          end_time: string
          status?: string
          type?: string | null
          notes?: string | null
          price?: number | null
          source?: string
          google_event_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          doctor_id?: string
          patient_id?: string | null
          appointment_date?: string
          start_time?: string
          end_time?: string
          status?: string
          type?: string | null
          notes?: string | null
          price?: number | null
          source?: string
          google_event_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      appointment_types: {
        Row: {
          id: string
          clinic_id: string
          name: string
          duration_minutes: number
          color: string
          price: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          duration_minutes?: number
          color?: string
          price?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          duration_minutes?: number
          color?: string
          price?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      reminders: {
        Row: {
          id: string
          appointment_id: string
          type: string
          status: string
          scheduled_for: string
          sent_at: string | null
          error_message: string | null
          message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          type: string
          status?: string
          scheduled_for: string
          sent_at?: string | null
          error_message?: string | null
          message_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          type?: string
          status?: string
          scheduled_for?: string
          sent_at?: string | null
          error_message?: string | null
          message_id?: string | null
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          clinic_id: string
          channel: string
          channel_user_id: string
          patient_id: string | null
          patient_phone: string | null
          status: string
          last_message_at: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          channel: string
          channel_user_id: string
          patient_id?: string | null
          patient_phone?: string | null
          status?: string
          last_message_at?: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          channel?: string
          channel_user_id?: string
          patient_id?: string | null
          patient_phone?: string | null
          status?: string
          last_message_at?: string
          metadata?: Json
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          direction: string
          content: string
          parsed_intent: string | null
          channel_message_id: string | null
          status: string
          sent_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          direction: string
          content: string
          parsed_intent?: string | null
          channel_message_id?: string | null
          status?: string
          sent_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          direction?: string
          content?: string
          parsed_intent?: string | null
          channel_message_id?: string | null
          status?: string
          sent_at?: string
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
      get_or_create_conversation: {
        Args: {
          p_clinic_id: string
          p_channel: string
          p_channel_user_id: string
          p_patient_phone?: string
        }
        Returns: string
      }
      match_appointment_type: {
        Args: {
          p_clinic_id: string
          p_service_name: string
        }
        Returns: {
          id: string
          name: string
          duration_minutes: number
        }[]
      }
    }
    Enums: {
      messaging_channel: 'whatsapp' | 'messenger' | 'instagram' | 'viber'
    }
  }
}
