-- Add calendar_id to doctors for Google Calendar sync
-- Migration: 021_add_doctor_calendar_ids.sql

-- Add calendar_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'doctors' AND column_name = 'calendar_id'
    ) THEN
        ALTER TABLE doctors ADD COLUMN calendar_id VARCHAR(255);
    END IF;
END $$;

-- Update doctors with their Google Calendar IDs
-- Match by name pattern (д-р Иванов, д-р Стефанов, etc.)
UPDATE doctors SET calendar_id = '6b17f0fc84662aac383078dbca7390aaa68fe56ecacf3c3cea09d82eff16f11d@group.calendar.google.com'
WHERE name ILIKE '%Иванов%' AND calendar_id IS NULL;

UPDATE doctors SET calendar_id = '40754e0a142dac46e4492be2c088cbe297b3ad8350a7ccec3cad6e7da164a26a@group.calendar.google.com'
WHERE name ILIKE '%Стефанов%' AND calendar_id IS NULL;

UPDATE doctors SET calendar_id = 'b5c7dd9ffdd1f6d833042d9d0a74e81cb106940140f7ae832adbd55f74b5da11@group.calendar.google.com'
WHERE name ILIKE '%Недялков%' AND calendar_id IS NULL;

UPDATE doctors SET calendar_id = '9f1afdb8020735f5507852ffa490d918935b2f7824d8e8cbe97e0fc781e70223@group.calendar.google.com'
WHERE name ILIKE '%Чакъров%' AND calendar_id IS NULL;

-- Create index for faster calendar lookups
CREATE INDEX IF NOT EXISTS idx_doctors_calendar_id ON doctors(calendar_id) WHERE calendar_id IS NOT NULL;

-- Log results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count FROM doctors WHERE calendar_id IS NOT NULL;
    RAISE NOTICE 'Updated % doctors with calendar IDs', updated_count;
END $$;
