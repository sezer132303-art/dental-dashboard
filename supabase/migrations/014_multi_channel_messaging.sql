-- =============================================
-- MULTI-CHANNEL MESSAGING INTEGRATION
-- Migration: 014_multi_channel_messaging.sql
-- Supports: WhatsApp, Messenger, Instagram, Viber
-- =============================================

-- 1. Create messaging channel enum
DO $$ BEGIN
    CREATE TYPE messaging_channel AS ENUM ('whatsapp', 'messenger', 'instagram', 'viber');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create unified conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    channel messaging_channel NOT NULL,
    channel_user_id VARCHAR(255) NOT NULL,  -- Phone for WhatsApp/Viber, PSID for Meta
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_phone VARCHAR(50),
    patient_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    -- Status: active, resolved, booking_complete, cancelled
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    -- Metadata: platform-specific data (page_id, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, channel, channel_user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_clinic ON conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_patient ON conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- 3. Create unified messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,
    -- Direction: 'inbound' (from user), 'outbound' (from system)
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    -- Type: text, image, audio, document, template
    parsed_intent VARCHAR(50),
    -- Intent: booking_request, availability_inquiry, confirmation, cancellation, general_inquiry
    channel_message_id VARCHAR(255),
    -- Platform-specific message ID
    status VARCHAR(20) DEFAULT 'sent',
    -- Status: sent, delivered, read, failed
    raw_payload JSONB,
    -- Original platform payload
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_intent ON messages(parsed_intent);
CREATE INDEX IF NOT EXISTS idx_messages_sent ON messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- 4. Create channel credentials table
CREATE TABLE IF NOT EXISTS channel_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    channel messaging_channel NOT NULL,
    is_active BOOLEAN DEFAULT true,
    credentials JSONB NOT NULL DEFAULT '{}',
    -- WhatsApp: { instance_name, api_key, api_url }
    -- Messenger/Instagram: { page_id, page_access_token, app_secret, verify_token }
    -- Viber: { bot_token, bot_name }
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_channel_credentials_clinic ON channel_credentials(clinic_id);
CREATE INDEX IF NOT EXISTS idx_channel_credentials_active ON channel_credentials(is_active);

-- 5. Enable RLS on new tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_credentials ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
CREATE POLICY "Conversations viewable by clinic members" ON conversations
    FOR SELECT USING (true);

CREATE POLICY "Conversations can be inserted" ON conversations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Conversations can be updated" ON conversations
    FOR UPDATE USING (true);

-- Policies for messages
CREATE POLICY "Messages viewable by clinic members" ON messages
    FOR SELECT USING (true);

CREATE POLICY "Messages can be inserted" ON messages
    FOR INSERT WITH CHECK (true);

-- Policies for channel credentials
CREATE POLICY "Channel credentials viewable" ON channel_credentials
    FOR SELECT USING (true);

CREATE POLICY "Channel credentials manageable" ON channel_credentials
    FOR ALL USING (true);

-- 6. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversations_timestamp ON conversations;
CREATE TRIGGER update_conversations_timestamp
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_conversations_updated_at();

CREATE OR REPLACE FUNCTION update_channel_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_channel_credentials_timestamp ON channel_credentials;
CREATE TRIGGER update_channel_credentials_timestamp
    BEFORE UPDATE ON channel_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_channel_credentials_updated_at();

-- 7. Migrate existing WhatsApp data to unified tables
-- Migrate conversations
INSERT INTO conversations (id, clinic_id, channel, channel_user_id, patient_id, patient_phone, status, last_message_at, created_at, updated_at)
SELECT
    id,
    clinic_id,
    'whatsapp'::messaging_channel,
    patient_phone,
    patient_id,
    patient_phone,
    status,
    COALESCE(updated_at, created_at),
    created_at,
    updated_at
FROM whatsapp_conversations
ON CONFLICT (clinic_id, channel, channel_user_id) DO NOTHING;

-- Migrate messages
INSERT INTO messages (id, conversation_id, direction, content, message_type, parsed_intent, channel_message_id, raw_payload, sent_at, delivered_at, read_at, created_at)
SELECT
    id,
    conversation_id,
    direction,
    content,
    message_type,
    parsed_intent,
    message_id,
    raw_payload,
    sent_at,
    delivered_at,
    read_at,
    created_at
FROM whatsapp_messages
ON CONFLICT DO NOTHING;

-- 8. Migrate WhatsApp credentials from clinics table to channel_credentials
INSERT INTO channel_credentials (clinic_id, channel, is_active, credentials)
SELECT
    id,
    'whatsapp'::messaging_channel,
    true,
    jsonb_build_object(
        'instance_name', COALESCE(whatsapp_instance, ''),
        'api_key', COALESCE(whatsapp_api_key, ''),
        'api_url', COALESCE(evolution_api_url, '')
    )
FROM clinics
WHERE whatsapp_instance IS NOT NULL OR whatsapp_api_key IS NOT NULL
ON CONFLICT (clinic_id, channel) DO NOTHING;

-- 9. Add source options to appointments
UPDATE appointments SET source = 'whatsapp' WHERE source = 'whatsapp';
-- Future sources: 'messenger', 'instagram', 'viber', 'manual', 'phone', 'google_calendar'

-- 10. Create view for conversation statistics per channel
CREATE OR REPLACE VIEW conversation_stats AS
SELECT
    clinic_id,
    channel,
    COUNT(*) as total_conversations,
    COUNT(*) FILTER (WHERE status = 'active') as active_conversations,
    COUNT(*) FILTER (WHERE status = 'booking_complete') as completed_bookings,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as conversations_this_week,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as conversations_today
FROM conversations
GROUP BY clinic_id, channel;

-- 11. Create function to get or create conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_clinic_id UUID,
    p_channel messaging_channel,
    p_channel_user_id VARCHAR(255),
    p_patient_phone VARCHAR(50) DEFAULT NULL,
    p_patient_name VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- Try to find existing active conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE clinic_id = p_clinic_id
      AND channel = p_channel
      AND channel_user_id = p_channel_user_id
      AND status = 'active'
    LIMIT 1;

    -- Create new if not found
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (clinic_id, channel, channel_user_id, patient_phone, patient_name)
        VALUES (p_clinic_id, p_channel, p_channel_user_id, p_patient_phone, p_patient_name)
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE conversations IS 'Unified conversations table for all messaging channels (WhatsApp, Messenger, Instagram, Viber)';
COMMENT ON TABLE messages IS 'Messages belonging to conversations from all channels';
COMMENT ON TABLE channel_credentials IS 'API credentials for each messaging channel per clinic';
