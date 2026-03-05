-- Add chatbot_enabled column to clinics table
-- When false, WhatsApp chatbot won't send automatic AI responses
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS chatbot_enabled BOOLEAN DEFAULT true;

-- Store the n8n workflow ID for each clinic's chatbot
-- Used to activate/deactivate the workflow via n8n API
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS n8n_chatbot_workflow_id TEXT;
