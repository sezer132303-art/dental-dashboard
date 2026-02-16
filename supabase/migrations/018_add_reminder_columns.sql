-- Add missing reminder tracking columns to appointments table
-- These columns track whether reminder notifications have been sent

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_3h_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS followup_sent BOOLEAN DEFAULT false;

-- Add index for faster reminder queries
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_24h
ON appointments(appointment_date, reminder_24h_sent)
WHERE reminder_24h_sent = false;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_3h
ON appointments(appointment_date, start_time, reminder_3h_sent)
WHERE reminder_3h_sent = false;
