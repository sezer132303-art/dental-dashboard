-- =============================================
-- DENTAL DASHBOARD - SEED DATA
-- Migration: 004_seed_data.sql
-- =============================================

-- Get clinic ID (assumes clinic exists from previous migration)
DO $$
DECLARE
    v_clinic_id UUID;
    v_doctor1_id UUID;
    v_doctor2_id UUID;
    v_doctor3_id UUID;
    v_doctor4_id UUID;
    v_patient1_id UUID;
    v_patient2_id UUID;
    v_patient3_id UUID;
    v_patient4_id UUID;
    v_patient5_id UUID;
    v_patient6_id UUID;
    v_patient7_id UUID;
    v_patient8_id UUID;
BEGIN
    -- Get the first clinic
    SELECT id INTO v_clinic_id FROM clinics LIMIT 1;

    -- If no clinic exists, create one
    IF v_clinic_id IS NULL THEN
        INSERT INTO clinics (name, address, phone)
        VALUES ('Дентална клиника СЕТТ', 'София, ул. Примерна 1', '02 123 4567')
        RETURNING id INTO v_clinic_id;
    END IF;

    -- =============================================
    -- INSERT DOCTORS
    -- =============================================
    INSERT INTO doctors (id, clinic_id, name, specialty, phone, email, color, bio)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'д-р Иван Иванов', 'Ортодонт', '0888 111 111', 'ivanov@dental.bg', 'bg-blue-500', 'Специалист по ортодонтия с 15 години опит')
    RETURNING id INTO v_doctor1_id;

    INSERT INTO doctors (id, clinic_id, name, specialty, phone, email, color, bio)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'д-р Петър Стефанов', 'Имплантолог', '0888 222 222', 'stefanov@dental.bg', 'bg-purple-500', 'Водещ специалист по дентални импланти')
    RETURNING id INTO v_doctor2_id;

    INSERT INTO doctors (id, clinic_id, name, specialty, phone, email, color, bio)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'д-р Георги Недялков', 'Ендодонт', '0888 333 333', 'nedyalkov@dental.bg', 'bg-green-500', 'Експерт по лечение на коренови канали')
    RETURNING id INTO v_doctor3_id;

    INSERT INTO doctors (id, clinic_id, name, specialty, phone, email, color, bio)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'д-р Димитър Чакъров', 'Орален хирург', '0888 444 444', 'chakarov@dental.bg', 'bg-orange-500', 'Специалист по орална хирургия')
    RETURNING id INTO v_doctor4_id;

    -- =============================================
    -- INSERT PATIENTS
    -- =============================================
    INSERT INTO patients (id, clinic_id, name, phone, email, date_of_birth, gender)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Мария Петрова', '359888100001', 'maria.petrova@email.com', '1985-03-15', 'female')
    RETURNING id INTO v_patient1_id;

    INSERT INTO patients (id, clinic_id, name, phone, email, date_of_birth, gender)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Георги Димитров', '359888100002', 'georgi.dimitrov@email.com', '1978-07-22', 'male')
    RETURNING id INTO v_patient2_id;

    INSERT INTO patients (id, clinic_id, name, phone, email, date_of_birth, gender)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Елена Иванова', '359888100003', 'elena.ivanova@email.com', '1990-11-08', 'female')
    RETURNING id INTO v_patient3_id;

    INSERT INTO patients (id, clinic_id, name, phone, email, date_of_birth, gender)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Николай Стоянов', '359888100004', 'nikolay.stoyanov@email.com', '1965-01-30', 'male')
    RETURNING id INTO v_patient4_id;

    INSERT INTO patients (id, clinic_id, name, phone, email, date_of_birth, gender)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Анна Георгиева', '359888100005', 'anna.georgieva@email.com', '1995-05-12', 'female')
    RETURNING id INTO v_patient5_id;

    INSERT INTO patients (id, clinic_id, name, phone, email, date_of_birth, gender)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Стефан Колев', '359888100006', 'stefan.kolev@email.com', '1982-09-25', 'male')
    RETURNING id INTO v_patient6_id;

    INSERT INTO patients (id, clinic_id, name, phone, email, date_of_birth, gender)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Виктория Тодорова', '359888100007', 'viktoria.todorova@email.com', '1988-12-03', 'female')
    RETURNING id INTO v_patient7_id;

    INSERT INTO patients (id, clinic_id, name, phone, email, date_of_birth, gender)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Александър Младенов', '359888100008', 'alex.mladenov@email.com', '1975-06-18', 'male')
    RETURNING id INTO v_patient8_id;

    -- =============================================
    -- INSERT APPOINTMENTS (This week)
    -- =============================================

    -- Today's appointments
    INSERT INTO appointments (clinic_id, doctor_id, patient_id, appointment_date, start_time, end_time, status, type, notes)
    VALUES
        (v_clinic_id, v_doctor1_id, v_patient1_id, CURRENT_DATE, '09:00', '09:30', 'confirmed', 'Преглед', 'Редовен преглед'),
        (v_clinic_id, v_doctor1_id, v_patient2_id, CURRENT_DATE, '10:00', '11:00', 'confirmed', 'Ортодонтия', 'Поставяне на брекети'),
        (v_clinic_id, v_doctor1_id, v_patient3_id, CURRENT_DATE, '11:30', '12:00', 'scheduled', 'Консултация', NULL),
        (v_clinic_id, v_doctor2_id, v_patient4_id, CURRENT_DATE, '09:30', '10:30', 'confirmed', 'Имплант', 'Втора фаза'),
        (v_clinic_id, v_doctor2_id, v_patient5_id, CURRENT_DATE, '14:00', '15:00', 'scheduled', 'Консултация', 'Първична консултация за импланти'),
        (v_clinic_id, v_doctor3_id, v_patient6_id, CURRENT_DATE, '10:00', '11:00', 'confirmed', 'Ендодонтия', 'Лечение на канал'),
        (v_clinic_id, v_doctor4_id, v_patient7_id, CURRENT_DATE, '15:00', '16:00', 'scheduled', 'Екстракция', 'Изваждане на мъдрец');

    -- Tomorrow's appointments
    INSERT INTO appointments (clinic_id, doctor_id, patient_id, appointment_date, start_time, end_time, status, type)
    VALUES
        (v_clinic_id, v_doctor1_id, v_patient8_id, CURRENT_DATE + 1, '09:00', '09:30', 'scheduled', 'Преглед'),
        (v_clinic_id, v_doctor1_id, v_patient1_id, CURRENT_DATE + 1, '10:00', '10:30', 'scheduled', 'Контролен преглед'),
        (v_clinic_id, v_doctor2_id, v_patient2_id, CURRENT_DATE + 1, '11:00', '12:00', 'scheduled', 'Консултация'),
        (v_clinic_id, v_doctor3_id, v_patient3_id, CURRENT_DATE + 1, '14:00', '15:00', 'scheduled', 'Ендодонтия'),
        (v_clinic_id, v_doctor4_id, v_patient4_id, CURRENT_DATE + 1, '16:00', '17:00', 'scheduled', 'Хирургия');

    -- Day after tomorrow
    INSERT INTO appointments (clinic_id, doctor_id, patient_id, appointment_date, start_time, end_time, status, type)
    VALUES
        (v_clinic_id, v_doctor1_id, v_patient5_id, CURRENT_DATE + 2, '09:00', '10:00', 'scheduled', 'Ортодонтия'),
        (v_clinic_id, v_doctor2_id, v_patient6_id, CURRENT_DATE + 2, '10:00', '11:00', 'scheduled', 'Имплант'),
        (v_clinic_id, v_doctor3_id, v_patient7_id, CURRENT_DATE + 2, '11:00', '12:00', 'scheduled', 'Преглед'),
        (v_clinic_id, v_doctor4_id, v_patient8_id, CURRENT_DATE + 2, '14:00', '15:00', 'scheduled', 'Консултация');

    -- Past appointments (completed/no-show for statistics)
    INSERT INTO appointments (clinic_id, doctor_id, patient_id, appointment_date, start_time, end_time, status, type)
    VALUES
        (v_clinic_id, v_doctor1_id, v_patient1_id, CURRENT_DATE - 7, '09:00', '09:30', 'completed', 'Преглед'),
        (v_clinic_id, v_doctor1_id, v_patient2_id, CURRENT_DATE - 7, '10:00', '10:30', 'completed', 'Преглед'),
        (v_clinic_id, v_doctor1_id, v_patient3_id, CURRENT_DATE - 7, '11:00', '11:30', 'no_show', 'Преглед'),
        (v_clinic_id, v_doctor2_id, v_patient4_id, CURRENT_DATE - 7, '14:00', '15:00', 'completed', 'Имплант'),
        (v_clinic_id, v_doctor2_id, v_patient5_id, CURRENT_DATE - 6, '09:00', '10:00', 'completed', 'Консултация'),
        (v_clinic_id, v_doctor3_id, v_patient6_id, CURRENT_DATE - 6, '10:00', '11:00', 'completed', 'Ендодонтия'),
        (v_clinic_id, v_doctor3_id, v_patient7_id, CURRENT_DATE - 5, '11:00', '12:00', 'cancelled', 'Преглед'),
        (v_clinic_id, v_doctor4_id, v_patient8_id, CURRENT_DATE - 5, '14:00', '15:00', 'completed', 'Екстракция'),
        (v_clinic_id, v_doctor4_id, v_patient1_id, CURRENT_DATE - 4, '09:00', '10:00', 'completed', 'Контролен преглед'),
        (v_clinic_id, v_doctor1_id, v_patient2_id, CURRENT_DATE - 3, '10:00', '11:00', 'completed', 'Ортодонтия'),
        (v_clinic_id, v_doctor2_id, v_patient3_id, CURRENT_DATE - 2, '11:00', '12:00', 'no_show', 'Консултация'),
        (v_clinic_id, v_doctor3_id, v_patient4_id, CURRENT_DATE - 1, '14:00', '15:00', 'completed', 'Ендодонтия');

    -- =============================================
    -- INSERT APPOINTMENT TYPES
    -- =============================================
    INSERT INTO appointment_types (clinic_id, name, duration_minutes, color, price)
    VALUES
        (v_clinic_id, 'Преглед', 30, 'bg-blue-500', 50.00),
        (v_clinic_id, 'Консултация', 30, 'bg-green-500', 40.00),
        (v_clinic_id, 'Почистване', 45, 'bg-cyan-500', 80.00),
        (v_clinic_id, 'Пломба', 60, 'bg-yellow-500', 120.00),
        (v_clinic_id, 'Ендодонтия', 90, 'bg-orange-500', 250.00),
        (v_clinic_id, 'Екстракция', 45, 'bg-red-500', 100.00),
        (v_clinic_id, 'Имплант', 120, 'bg-purple-500', 800.00),
        (v_clinic_id, 'Ортодонтия', 60, 'bg-pink-500', 150.00),
        (v_clinic_id, 'Избелване', 60, 'bg-indigo-500', 200.00);

END $$;
