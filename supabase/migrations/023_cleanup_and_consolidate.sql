-- =============================================
-- DENTAL DASHBOARD - CLEANUP & CONSOLIDATION
-- Migration: 023_cleanup_and_consolidate.sql
-- =============================================
-- This migration consolidates and fixes issues from previous migrations

-- =============================================
-- 1. FIX TIMEZONE OFFSET (with guard)
-- =============================================
-- Only run if not already applied (check for marker)
DO $$
BEGIN
    -- Check if we already applied the timezone fix
    -- We do this by checking if a marker exists in a settings table or by timestamp
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'migration_markers'
        AND n.nspname = 'public'
    ) THEN
        -- Create marker table if it doesn't exist
        CREATE TABLE IF NOT EXISTS migration_markers (
            migration_name VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- Only apply timezone fix if not already done
    IF NOT EXISTS (
        SELECT 1 FROM migration_markers WHERE migration_name = 'timezone_fix_022'
    ) THEN
        -- Fix timezone offset for appointments synced before Europe/Sofia fix
        UPDATE appointments
        SET
            start_time = (start_time::time + INTERVAL '2 hours')::time,
            end_time = (end_time::time + INTERVAL '2 hours')::time,
            updated_at = NOW()
        WHERE source = 'google_calendar'
          AND google_event_id IS NOT NULL
          AND updated_at < '2026-02-16'::date;  -- Only fix old records

        INSERT INTO migration_markers (migration_name) VALUES ('timezone_fix_022')
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Timezone fix applied';
    ELSE
        RAISE NOTICE 'Timezone fix already applied, skipping';
    END IF;
END $$;

-- =============================================
-- 2. ENSURE CALENDAR_ID COLUMN EXISTS (idempotent)
-- =============================================
-- This handles both migration 013 and 021 which both try to add this column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'doctors' AND column_name = 'calendar_id'
    ) THEN
        ALTER TABLE doctors ADD COLUMN calendar_id VARCHAR(255);
    END IF;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_doctors_calendar_id ON doctors(calendar_id) WHERE calendar_id IS NOT NULL;

-- =============================================
-- 3. ENSURE SOURCE COLUMN EXISTS (idempotent)
-- =============================================
-- This handles both migration 008 and 011 which both try to add this column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'source'
    ) THEN
        ALTER TABLE appointments ADD COLUMN source VARCHAR(20) DEFAULT 'manual';
    END IF;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_appointments_source ON appointments(source);

-- =============================================
-- 4. DROP UNUSED LEGACY TABLES (optional - commented out for safety)
-- =============================================
-- Uncomment these if you want to clean up legacy tables after confirming
-- data has been migrated to the new unified tables

-- DROP TABLE IF EXISTS clients CASCADE;
-- DROP TABLE IF EXISTS whatsapp_conversations CASCADE;
-- DROP TABLE IF EXISTS whatsapp_messages CASCADE;

-- =============================================
-- 5. ENSURE GOOGLE_EVENT_ID COLUMN EXISTS (idempotent)
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'google_event_id'
    ) THEN
        ALTER TABLE appointments ADD COLUMN google_event_id VARCHAR(255);
    END IF;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_appointments_google_event ON appointments(google_event_id) WHERE google_event_id IS NOT NULL;

-- =============================================
-- 6. CREATE UNIFIED CONSTRAINT FOR GOOGLE EVENTS (idempotent)
-- =============================================
-- Note: This handles the duplicate prevention for Google Calendar sync
DO $$
BEGIN
    -- First drop any existing constraint with similar name
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_clinic_google_event'
    ) THEN
        ALTER TABLE appointments DROP CONSTRAINT unique_clinic_google_event;
    END IF;

    -- Create the constraint if google_event_id column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'google_event_id'
    ) THEN
        ALTER TABLE appointments
        ADD CONSTRAINT unique_clinic_google_event
        UNIQUE (clinic_id, google_event_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint already exists';
END $$;

-- =============================================
-- 7. CREATE CONVERSATION_STATS VIEW
-- =============================================
CREATE OR REPLACE VIEW conversation_stats AS
SELECT
    clinic_id,
    channel,
    COUNT(*) as total_conversations,
    COUNT(*) FILTER (WHERE status = 'active') as active_conversations,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_conversations,
    MAX(last_message_at) as last_activity
FROM conversations
GROUP BY clinic_id, channel;

-- =============================================
-- 8. LOG COMPLETION
-- =============================================
DO $$
BEGIN
    RAISE NOTICE 'Cleanup and consolidation migration completed';
END $$;
