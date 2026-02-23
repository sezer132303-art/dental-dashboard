-- Fix timezone offset for appointments synced before the Europe/Sofia fix
-- These appointments were saved 2 hours earlier than they should be
-- (UTC instead of Europe/Sofia timezone)

-- Update start_time and end_time by adding 2 hours
UPDATE appointments
SET
    start_time = (start_time::time + INTERVAL '2 hours')::time,
    end_time = (end_time::time + INTERVAL '2 hours')::time,
    updated_at = NOW()
WHERE source = 'google_calendar'
  AND google_event_id IS NOT NULL;

-- Log how many were updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Fixed timezone for % appointments', updated_count;
END $$;
