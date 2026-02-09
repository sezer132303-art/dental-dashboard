-- =====================================================
-- Dental Dashboard - Seed Data for Development
-- Run this AFTER 001_initial_schema.sql
-- =====================================================

-- =====================================================
-- 1. INSERT DOCTORS (Dashboard Users)
-- =====================================================
-- Update phone numbers with real ones for testing

INSERT INTO users (phone, name, email, role, clinic_id) VALUES
  ('+359888000001', 'д-р Иванов', 'ivanov@clinic.bg', 'doctor', '00000000-0000-0000-0000-000000000001'),
  ('+359888000002', 'д-р Стефанов', 'stefanov@clinic.bg', 'doctor', '00000000-0000-0000-0000-000000000001'),
  ('+359888000003', 'д-р Недялков', 'nedyalkov@clinic.bg', 'doctor', '00000000-0000-0000-0000-000000000001'),
  ('+359888000004', 'д-р Чакъров', 'chakarov@clinic.bg', 'doctor', '00000000-0000-0000-0000-000000000001'),
  ('+359888000005', 'Администратор', 'admin@clinic.bg', 'admin', '00000000-0000-0000-0000-000000000001'),
  ('+359888000006', 'Рецепция', 'reception@clinic.bg', 'receptionist', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- =====================================================
-- 2. UPDATE EXISTING CLIENTS WITH CLINIC_ID
-- =====================================================
UPDATE clients
SET clinic_id = '00000000-0000-0000-0000-000000000001'
WHERE clinic_id IS NULL;

-- =====================================================
-- 3. UPDATE EXISTING APPOINTMENTS WITH CLINIC_ID
-- =====================================================
UPDATE appointments
SET clinic_id = '00000000-0000-0000-0000-000000000001'
WHERE clinic_id IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check inserted users
SELECT id, phone, name, role FROM users;

-- Check clinic
SELECT * FROM clinics;
