-- Add google_event_id to appointments for calendar sync
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_google_event
ON appointments(google_event_id)
WHERE google_event_id IS NOT NULL;

-- Add source column if not exists (for tracking where appointment came from)
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_appointments_source ON appointments(source);
