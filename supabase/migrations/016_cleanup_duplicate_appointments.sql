-- Migration: Cleanup duplicate appointments and prevent future duplicates
-- This migration removes duplicate appointments (keeping the oldest) and adds a unique constraint

-- Step 1: Delete duplicate appointments, keeping the oldest one per google_event_id per clinic
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY clinic_id, google_event_id
           ORDER BY created_at ASC
         ) as rn
  FROM appointments
  WHERE google_event_id IS NOT NULL
)
DELETE FROM appointments
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Add unique constraint to prevent future duplicates
-- This ensures only one appointment per google_event_id per clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_clinic_google_event_unique'
  ) THEN
    ALTER TABLE appointments
    ADD CONSTRAINT appointments_clinic_google_event_unique
    UNIQUE (clinic_id, google_event_id);
  END IF;
EXCEPTION
  WHEN others THEN
    -- If constraint already exists or there's an error, log and continue
    RAISE NOTICE 'Could not add constraint: %', SQLERRM;
END $$;

-- Step 3: Create index for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id
ON appointments(google_event_id)
WHERE google_event_id IS NOT NULL;
