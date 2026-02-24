-- =============================================
-- CLEANUP SEED/DEMO DATA
-- Migration: 024_cleanup_seed_data.sql
-- =============================================

-- Delete demo patients (with fake phone numbers 359888100001-8)
DELETE FROM appointments
WHERE patient_id IN (
    SELECT id FROM patients
    WHERE phone LIKE '359888100%'
);

DELETE FROM patients
WHERE phone LIKE '359888100%';

-- Delete demo users (with fake phone numbers +359888000001-6)
DELETE FROM users
WHERE phone LIKE '+359888000%'
   OR phone LIKE '359888000%';

-- Delete demo doctors (with fake phones 0888 111 111, etc.)
DELETE FROM appointments
WHERE doctor_id IN (
    SELECT id FROM doctors
    WHERE phone LIKE '0888 %'
);

DELETE FROM doctors
WHERE phone LIKE '0888 %';

-- Clean up orphaned appointments (no patient or doctor)
DELETE FROM appointments
WHERE patient_id IS NULL
   OR doctor_id IS NULL;

-- Clean up demo appointment types if they exist (optional - keep useful ones)
-- DELETE FROM appointment_types WHERE name IN ('Преглед', 'Консултация', ...);
-- Keeping appointment types as they are useful

-- Verify cleanup
DO $$
DECLARE
    v_patients INT;
    v_doctors INT;
    v_users INT;
    v_appointments INT;
BEGIN
    SELECT COUNT(*) INTO v_patients FROM patients WHERE phone LIKE '359888100%';
    SELECT COUNT(*) INTO v_doctors FROM doctors WHERE phone LIKE '0888 %';
    SELECT COUNT(*) INTO v_users FROM users WHERE phone LIKE '+359888000%' OR phone LIKE '359888000%';
    SELECT COUNT(*) INTO v_appointments FROM appointments WHERE patient_id IS NULL OR doctor_id IS NULL;

    RAISE NOTICE 'Cleanup complete:';
    RAISE NOTICE '  - Demo patients remaining: %', v_patients;
    RAISE NOTICE '  - Demo doctors remaining: %', v_doctors;
    RAISE NOTICE '  - Demo users remaining: %', v_users;
    RAISE NOTICE '  - Orphaned appointments remaining: %', v_appointments;
END $$;
