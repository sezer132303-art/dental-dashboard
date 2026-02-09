-- =============================================
-- DENTAL DASHBOARD - SESSIONS AND ROLES
-- Migration: 007_sessions_and_roles.sql
-- =============================================

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Add receptionist role to users if not supported
DO $$
BEGIN
  -- Update role column to support receptionist
  ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

  ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'doctor', 'receptionist'));
EXCEPTION
  WHEN others THEN NULL;
END $$;
