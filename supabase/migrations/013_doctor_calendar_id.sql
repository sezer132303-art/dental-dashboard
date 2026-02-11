-- Add calendar_id to doctors table for individual calendar sync
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS calendar_id VARCHAR(255);

-- Add index for calendar lookups
CREATE INDEX IF NOT EXISTS idx_doctors_calendar ON doctors(calendar_id)
WHERE calendar_id IS NOT NULL;
