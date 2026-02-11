-- Add google_calendar_id column to clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clinics_google_calendar ON clinics(google_calendar_id) WHERE google_calendar_id IS NOT NULL;
