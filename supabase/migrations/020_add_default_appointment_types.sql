-- Add default appointment types with realistic durations
-- This ensures the overlap prevention works correctly based on service duration

-- First, get the default clinic ID and insert appointment types
DO $$
DECLARE
    clinic_uuid UUID;
BEGIN
    -- Get first clinic (or create if needed)
    SELECT id INTO clinic_uuid FROM clinics LIMIT 1;

    IF clinic_uuid IS NOT NULL THEN
        -- Insert default appointment types (ignore if already exists)
        INSERT INTO appointment_types (clinic_id, name, duration_minutes, price, color, is_active)
        VALUES
            -- Quick appointments (30 min)
            (clinic_uuid, 'Преглед', 30, 50.00, 'bg-blue-500', true),
            (clinic_uuid, 'Консултация', 30, 40.00, 'bg-cyan-500', true),

            -- Standard appointments (45 min)
            (clinic_uuid, 'Почистване на зъбен камък', 45, 80.00, 'bg-green-500', true),
            (clinic_uuid, 'Пломба', 45, 100.00, 'bg-yellow-500', true),
            (clinic_uuid, 'Избелване', 45, 200.00, 'bg-purple-500', true),

            -- Longer procedures (60 min)
            (clinic_uuid, 'Екстракция', 60, 150.00, 'bg-red-500', true),
            (clinic_uuid, 'Изваждане на зъб', 60, 150.00, 'bg-red-500', true),
            (clinic_uuid, 'Лечение на канал', 60, 250.00, 'bg-orange-500', true),
            (clinic_uuid, 'Корен', 60, 250.00, 'bg-orange-500', true),

            -- Complex procedures (90 min)
            (clinic_uuid, 'Ендодонтско лечение', 90, 350.00, 'bg-pink-500', true),
            (clinic_uuid, 'Коронка', 90, 400.00, 'bg-indigo-500', true),
            (clinic_uuid, 'Мост', 90, 500.00, 'bg-indigo-500', true),

            -- Long procedures (120 min)
            (clinic_uuid, 'Имплант', 120, 1500.00, 'bg-teal-500', true),
            (clinic_uuid, 'Хирургия', 120, 500.00, 'bg-rose-500', true)
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Added default appointment types for clinic %', clinic_uuid;
    END IF;
END $$;

-- Create a helper function for matching service types (fuzzy search)
CREATE OR REPLACE FUNCTION match_appointment_type(
    p_clinic_id UUID,
    p_type_name TEXT
) RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    duration_minutes INTEGER,
    price DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        at.id,
        at.name,
        at.duration_minutes,
        at.price
    FROM appointment_types at
    WHERE at.clinic_id = p_clinic_id
      AND at.is_active = true
      AND (
          at.name ILIKE '%' || p_type_name || '%'
          OR p_type_name ILIKE '%' || at.name || '%'
      )
    ORDER BY
        -- Prefer exact matches
        CASE WHEN LOWER(at.name) = LOWER(p_type_name) THEN 0 ELSE 1 END,
        -- Then prefer starts with
        CASE WHEN at.name ILIKE p_type_name || '%' THEN 0 ELSE 1 END,
        at.name
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add common Bulgarian dental terms mapping
COMMENT ON TABLE appointment_types IS 'Appointment types with duration. Common terms:
- преглед/checkup → 30 min
- почистване/cleaning → 45 min
- пломба/filling → 45 min
- екстракция/изваждане/extraction → 60 min
- канал/корен/root canal → 60 min
- коронка/crown → 90 min
- имплант/implant → 120 min';
