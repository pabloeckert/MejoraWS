-- ==============================================================================
-- MEJORAWS — MIGRACIÓN 002: TELEMETRÍA IA (FINOPS 2026), @lid INDEX Y MIGRACIONES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(128) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. Soporte de nivel de razonamiento Gemini 3.8+ (low | medium | high | xhigh)
ALTER TABLE ai_config
    ADD COLUMN IF NOT EXISTS thinking_level VARCHAR(16) NOT NULL DEFAULT 'high';

-- 2. Tabla de telemetría FinOps para tokens de razonamiento y respuesta LLM
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id VARCHAR(64) NOT NULL DEFAULT 'principal_v1',
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    provider VARCHAR(32) NOT NULL,
    model VARCHAR(128) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    thought_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    intent VARCHAR(64) NOT NULL DEFAULT 'CONTAIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
    ON ai_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_contact
    ON ai_usage_logs(contact_id);

-- 3. Índice JSONB para resolución rápida de identificadores @lid (WhatsApp 2026-2027)
CREATE INDEX IF NOT EXISTS idx_contacts_lid
    ON contacts ((metadata->>'lid'))
    WHERE metadata ? 'lid';

-- 4. Autocura de configuración inicial de IA si la tabla quedó vacía
INSERT INTO ai_config (
    id, is_global_enabled, system_prompt, model_name, thinking_level,
    max_auto_turns, auto_mute_hours_on_human_reply
)
VALUES (
    1,
    true,
    'Eres el asistente de atención y retención de Mejora Continua. Tu tono es empático, profesional, natural y humano. Respondes con brevedad para clarificar y contener. Si el contacto muestra intención de compra o pide hablar con un responsable, confirmas amablemente y notificas al equipo sin usar frases robóticas ni avisos de transferencia.',
    'gemini-3.8-flash',
    'high',
    2,
    24
) ON CONFLICT (id) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('002_ai_telemetry_and_migrations.sql')
ON CONFLICT (version) DO NOTHING;
