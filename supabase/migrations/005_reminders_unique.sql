-- =============================================
-- DENTAL DASHBOARD - REMINDERS UNIQUE CONSTRAINT
-- Migration: 005_reminders_unique.sql
-- =============================================

-- Add unique constraint for appointment_id and type
-- This allows the n8n workflows to use ON CONFLICT
ALTER TABLE reminders
ADD CONSTRAINT reminders_appointment_type_unique
UNIQUE (appointment_id, type);

-- Add index for faster lookups by type
CREATE INDEX IF NOT EXISTS idx_reminders_type ON reminders(type);
