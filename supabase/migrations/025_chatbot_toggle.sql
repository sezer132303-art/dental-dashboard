-- Add chatbot_enabled column to clinics table
-- When false, WhatsApp chatbot won't send automatic AI responses
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS chatbot_enabled BOOLEAN DEFAULT true;
