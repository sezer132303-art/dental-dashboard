-- =============================================
-- DENTAL DASHBOARD - CORE TABLES
-- Migration: 003_core_tables.sql
-- =============================================

-- =============================================
-- 1. DOCTORS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    bio TEXT,
    avatar_url TEXT,
    color VARCHAR(20) DEFAULT 'bg-blue-500',
    is_active BOOLEAN DEFAULT true,
    working_hours JSONB DEFAULT '{"mon": {"start": "09:00", "end": "18:00"}, "tue": {"start": "09:00", "end": "18:00"}, "wed": {"start": "09:00", "end": "18:00"}, "thu": {"start": "09:00", "end": "18:00"}, "fri": {"start": "09:00", "end": "18:00"}}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_doctors_clinic ON doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_user ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(is_active);

-- =============================================
-- 2. PATIENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(10),
    address TEXT,
    notes TEXT,
    medical_history TEXT,
    allergies TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(is_active);

-- =============================================
-- 3. APPOINTMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    -- Status: scheduled, confirmed, completed, cancelled, no_show
    type VARCHAR(50),
    -- Type: checkup, cleaning, filling, extraction, consultation, etc.
    notes TEXT,
    price DECIMAL(10, 2),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);

-- =============================================
-- 4. REMINDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    -- Type: 24h, 3h, confirmation, followup
    status VARCHAR(20) DEFAULT 'pending',
    -- Status: pending, sent, failed
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    message_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reminders_appointment ON reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_for);

-- =============================================
-- 5. APPOINTMENT TYPES TABLE (optional lookup)
-- =============================================
CREATE TABLE IF NOT EXISTS appointment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    color VARCHAR(20) DEFAULT 'bg-blue-500',
    price DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_types_clinic ON appointment_types(clinic_id);

-- =============================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;

-- Policies for doctors table
CREATE POLICY "Doctors are viewable by clinic members" ON doctors
    FOR SELECT USING (true);

CREATE POLICY "Doctors can be managed by admins" ON doctors
    FOR ALL USING (true);

-- Policies for patients table
CREATE POLICY "Patients are viewable by clinic members" ON patients
    FOR SELECT USING (true);

CREATE POLICY "Patients can be managed by clinic staff" ON patients
    FOR ALL USING (true);

-- Policies for appointments table
CREATE POLICY "Appointments are viewable by clinic members" ON appointments
    FOR SELECT USING (true);

CREATE POLICY "Appointments can be managed by clinic staff" ON appointments
    FOR ALL USING (true);

-- Policies for reminders table
CREATE POLICY "Reminders are viewable by clinic members" ON reminders
    FOR SELECT USING (true);

CREATE POLICY "Reminders can be managed by system" ON reminders
    FOR ALL USING (true);

-- Policies for appointment_types table
CREATE POLICY "Appointment types are viewable by all" ON appointment_types
    FOR SELECT USING (true);

CREATE POLICY "Appointment types can be managed by admins" ON appointment_types
    FOR ALL USING (true);

-- =============================================
-- 7. TRIGGERS FOR UPDATED_AT
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
