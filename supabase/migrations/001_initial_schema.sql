-- =====================================================
-- Dental Dashboard - Initial Schema Migration
-- Run this in Supabase SQL Editor: https://iqzcuacvhyoarioltrkl.supabase.co
-- =====================================================

-- Enable UUID extension (usually enabled by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CLINICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  whatsapp_instance VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default clinic
INSERT INTO clinics (id, name, whatsapp_instance)
VALUES ('00000000-0000-0000-0000-000000000001', 'Дентална клиника', 'default')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. USERS TABLE (Dashboard users - doctors, admins)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'doctor' CHECK (role IN ('admin', 'doctor', 'receptionist')),
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id);

-- =====================================================
-- 3. AUTH_TOKENS TABLE (Magic link tokens)
-- =====================================================
CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_phone ON auth_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at);

-- Auto-cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. ALTER CLIENTS TABLE (Add new columns if not exist)
-- =====================================================
-- Note: Run these one by one if the columns already exist

DO $$
BEGIN
  -- Add cancelled_appointments column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'cancelled_appointments') THEN
    ALTER TABLE clients ADD COLUMN cancelled_appointments INTEGER DEFAULT 0;
  END IF;

  -- Add completed_appointments column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'completed_appointments') THEN
    ALTER TABLE clients ADD COLUMN completed_appointments INTEGER DEFAULT 0;
  END IF;

  -- Add no_show_count column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'no_show_count') THEN
    ALTER TABLE clients ADD COLUMN no_show_count INTEGER DEFAULT 0;
  END IF;

  -- Add clinic_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'clinic_id') THEN
    ALTER TABLE clients ADD COLUMN clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 5. ALTER APPOINTMENTS TABLE (Add new columns if not exist)
-- =====================================================
DO $$
BEGIN
  -- Add completed_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'completed_at') THEN
    ALTER TABLE appointments ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add clinic_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'clinic_id') THEN
    ALTER TABLE appointments ADD COLUMN clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read clinics
CREATE POLICY IF NOT EXISTS "Allow read clinics" ON clinics
  FOR SELECT USING (true);

-- Policy: Allow service role full access to users
CREATE POLICY IF NOT EXISTS "Service role access users" ON users
  FOR ALL USING (true);

-- Policy: Allow service role full access to auth_tokens
CREATE POLICY IF NOT EXISTS "Service role access auth_tokens" ON auth_tokens
  FOR ALL USING (true);

-- =====================================================
-- 7. TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for clinics
DROP TRIGGER IF EXISTS update_clinics_updated_at ON clinics;
CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. INSERT TEST USER (for development)
-- =====================================================
-- Uncomment and modify with your phone number for testing
-- INSERT INTO users (phone, name, role, clinic_id)
-- VALUES ('+359888123456', 'Test Admin', 'admin', '00000000-0000-0000-0000-000000000001')
-- ON CONFLICT (phone) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify the migration was successful
-- =====================================================
-- SELECT * FROM clinics;
-- SELECT * FROM users;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clients';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'appointments';
