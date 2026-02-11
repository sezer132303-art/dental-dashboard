-- Extend phone field to support archived phones
-- Old: VARCHAR(20), New: VARCHAR(50)

ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(50);
ALTER TABLE patients ALTER COLUMN phone TYPE VARCHAR(50);
ALTER TABLE doctors ALTER COLUMN phone TYPE VARCHAR(50);

-- Note: whatsapp_conversations will be created with VARCHAR(50) in migration 008
