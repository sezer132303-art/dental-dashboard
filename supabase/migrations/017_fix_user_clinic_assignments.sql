-- Fix users with null clinic_id
-- Assign them to the default clinic: SETT BG Dental

-- Get the default clinic ID
DO $$
DECLARE
    default_clinic_id UUID;
BEGIN
    -- Get the first (and likely only) clinic
    SELECT id INTO default_clinic_id FROM clinics LIMIT 1;

    IF default_clinic_id IS NOT NULL THEN
        -- Update all users with null clinic_id
        UPDATE users
        SET clinic_id = default_clinic_id
        WHERE clinic_id IS NULL;

        RAISE NOTICE 'Updated users with clinic_id: %', default_clinic_id;
    ELSE
        RAISE WARNING 'No clinic found in the database';
    END IF;
END $$;

-- Also ensure the role is set for clinic users
UPDATE users
SET role = 'clinic'
WHERE role IS NULL OR role = '';

-- Verify the update
SELECT id, email, phone, name, role, clinic_id
FROM users
ORDER BY created_at DESC;
