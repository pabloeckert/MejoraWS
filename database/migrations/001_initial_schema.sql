-- ==============================================================================
-- MEJORAWS — ESQUEMA INICIAL DE BASE DE DATOS (PRD v1.0)
-- Gobernanza: Kendall & Kendall (Entidades Normalizadas y Tipado Finito)
-- ==============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id VARCHAR(64) NOT NULL DEFAULT 'principal_v1',
    jid VARCHAR(64) UNIQUE NOT NULL,
    phone_number VARCHAR(32) NOT NULL,
    push_name VARCHAR(255),
    address_book_name VARCHAR(255),
    is_in_broadcast BOOLEAN DEFAULT false,
    broadcast_lists JSONB DEFAULT '[]'::jsonb,
    ai_mode VARCHAR(32) DEFAULT 'AI_RETENTION' CHECK (ai_mode IN ('AI_RETENTION', 'HUMAN_TAKEOVER', 'MUTED')),
    ai_muted_until TIMESTAMP WITH TIME ZONE,
    is_whitelisted BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_instance ON contacts(instance_id);
CREATE INDEX IF NOT EXISTS idx_contacts_jid ON contacts(jid);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_mode ON contacts(ai_mode);
CREATE INDEX IF NOT EXISTS idx_contacts_whitelisted ON contacts(is_whitelisted);

-- 2. TABLA MESSAGES
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id VARCHAR(64) NOT NULL DEFAULT 'principal_v1',
    whatsapp_message_id VARCHAR(128) UNIQUE NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    direction VARCHAR(16) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    sender_type VARCHAR(32) NOT NULL CHECK (sender_type IN ('CONTACT', 'AI_AGENT', 'HUMAN_OWNER', 'SYSTEM_API')),
    content_type VARCHAR(32) NOT NULL CHECK (content_type IN ('TEXT', 'IMAGE', 'PDF', 'DOCUMENT', 'URL', 'BROADCAST_CAPTURE')),
    body TEXT NOT NULL,
    media_url TEXT,
    media_filename VARCHAR(255),
    is_broadcast BOOLEAN DEFAULT false,
    status VARCHAR(16) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_instance ON messages(instance_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- 3. TABLA SCHEDULED_JOBS
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id VARCHAR(64) NOT NULL DEFAULT 'principal_v1',
    idempotency_key VARCHAR(128) UNIQUE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    effective_send_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    attempts INTEGER DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_instance ON scheduled_jobs(instance_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_effective_send ON scheduled_jobs(effective_send_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_idempotency ON scheduled_jobs(idempotency_key);

-- 4. TABLA AI_CONFIG
CREATE TABLE IF NOT EXISTS ai_config (
    id SERIAL PRIMARY KEY,
    is_global_enabled BOOLEAN DEFAULT true,
    system_prompt TEXT NOT NULL,
    model_name VARCHAR(64) DEFAULT 'gemini-3.8-flash',
    thinking_level VARCHAR(16) NOT NULL DEFAULT 'high',
    max_auto_turns INTEGER DEFAULT 2,
    handoff_keywords JSONB DEFAULT '["precio", "comprar", "reunion", "llamame", "asesor", "info", "costo"]'::jsonb,
    auto_mute_hours_on_human_reply INTEGER DEFAULT 24,
    alert_webhook_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserción inicial de configuración de IA por defecto
INSERT INTO ai_config (id, is_global_enabled, system_prompt, model_name, thinking_level, max_auto_turns, auto_mute_hours_on_human_reply)
VALUES (
    1,
    true,
    'Eres el asistente de atención y retención de Mejora Continua. Tu tono es empático, profesional, natural y humano. Respondes con brevedad para clarificar y contener. Si el contacto muestra intención de compra o pide hablar con un responsable, confirmas amablemente y notificas al equipo sin usar frases robóticas ni avisos de transferencia.',
    'gemini-3.8-flash',
    'high',
    2,
    24
) ON CONFLICT (id) DO NOTHING;

-- 5. TABLA API_KEYS
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(128) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
