-- Migration: Add 'clinic' role to users table
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with 'clinic' role
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'doctor', 'receptionist', 'clinic'));

-- Create test clinic user (password: clinic123)
INSERT INTO users (phone, name, email, role, clinic_id, is_active, password_hash)
VALUES (
  '359888111111',
  'Тест Клиника',
  'clinic@test.bg',
  'clinic',
  '00000000-0000-0000-0000-000000000001',
  true,
  '$2b$10$zHbJyssXi.KKVteBtX/ENukvAVL1zRVlAJJrCEPFVVOMhcZku8ggS'
);

-- Verify
SELECT * FROM users WHERE role = 'clinic';
