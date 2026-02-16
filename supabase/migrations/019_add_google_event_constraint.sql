-- Add unique constraint for Google Calendar sync
-- This allows the upsert to work correctly with ON CONFLICT

-- First, check if google_event_id column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND column_name = 'google_event_id'
    ) THEN
        ALTER TABLE appointments ADD COLUMN google_event_id VARCHAR(255);
    END IF;
END $$;

-- Add unique constraint on clinic_id and google_event_id
-- This allows ON CONFLICT to work for upsert operations
ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_clinic_google_event_unique;

ALTER TABLE appointments
ADD CONSTRAINT appointments_clinic_google_event_unique
UNIQUE (clinic_id, google_event_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id
ON appointments(google_event_id)
WHERE google_event_id IS NOT NULL;
