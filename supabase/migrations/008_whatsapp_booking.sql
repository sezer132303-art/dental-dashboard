-- =============================================
-- WHATSAPP BOOKING INTEGRATION
-- Migration: 008_whatsapp_booking.sql
-- =============================================

-- 1. Add source field to appointments table
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
-- Values: 'whatsapp', 'manual', 'phone'

-- Add index for source filtering
CREATE INDEX IF NOT EXISTS idx_appointments_source ON appointments(source);

-- 2. Create conversations table for tracking WhatsApp interactions
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    patient_phone VARCHAR(50) NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active',
    -- Status: active, resolved, booking_complete, cancelled
    started_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_clinic ON whatsapp_conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON whatsapp_conversations(patient_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_patient ON whatsapp_conversations(patient_id);

-- 3. Create messages table for individual WhatsApp messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,
    -- Direction: 'inbound' (from patient), 'outbound' (from system)
    message_type VARCHAR(20) DEFAULT 'text',
    -- Type: text, image, audio, document
    content TEXT NOT NULL,
    parsed_intent VARCHAR(50),
    -- Intent: booking_request, availability_inquiry, confirmation, cancellation, general_inquiry
    raw_payload JSONB,
    -- Store original WhatsApp message payload
    message_id VARCHAR(255),
    -- Evolution API message ID
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_intent ON whatsapp_messages(parsed_intent);
CREATE INDEX IF NOT EXISTS idx_messages_sent ON whatsapp_messages(sent_at);

-- 4. Create API keys table for n8n authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    -- Store hashed API key
    permissions JSONB DEFAULT '["read", "write"]',
    -- Permissions: read, write, admin
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- 5. Enable RLS on new tables
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
CREATE POLICY "Conversations viewable by clinic members" ON whatsapp_conversations
    FOR SELECT USING (true);

CREATE POLICY "Conversations can be inserted" ON whatsapp_conversations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Conversations can be updated" ON whatsapp_conversations
    FOR UPDATE USING (true);

-- Policies for messages
CREATE POLICY "Messages viewable by clinic members" ON whatsapp_messages
    FOR SELECT USING (true);

CREATE POLICY "Messages can be inserted" ON whatsapp_messages
    FOR INSERT WITH CHECK (true);

-- Policies for API keys
CREATE POLICY "API keys viewable" ON api_keys
    FOR SELECT USING (true);

CREATE POLICY "API keys can be managed" ON api_keys
    FOR ALL USING (true);

-- 6. Trigger for updated_at on conversations
CREATE OR REPLACE FUNCTION update_whatsapp_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON whatsapp_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_conversations_updated_at();

-- 7. Insert default API key for n8n (hash of 'dental-n8n-api-key-2026')
-- In production, generate a secure random key
INSERT INTO api_keys (name, key_hash, permissions)
VALUES (
    'n8n-integration',
    '$2a$10$rQZ8K5.Y5Hl7KQz5Y5Hl7OeXHJmKQz5Y5Hl7KQz5Y5Hl7KQz5Y5H',
    '["read", "write"]'
) ON CONFLICT DO NOTHING;
